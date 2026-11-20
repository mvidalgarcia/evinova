import path from "node:path";
import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  ComparisonOperator,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import {
  LambdaDeploymentGroup,
  type ILambdaDeploymentConfig,
} from "aws-cdk-lib/aws-codedeploy";
import { Alias, Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

// The app is referenced by path, never imported (see AGENTS.md import boundaries).
const REPO_ROOT = path.resolve(import.meta.dirname, "..");

export interface FeedbackStackProps extends StackProps {
  /** How CodeDeploy shifts traffic to a new Lambda version. */
  deploymentConfig: ILambdaDeploymentConfig;
}

/**
 * One environment of the service. Browser and API share one origin:
 *
 * browser ──► CloudFront ──┬─ /api/*  ──► API Gateway ──► Lambda alias "live" ──► version N (or N+1 during canary)
 *                          │                                      │
 *                          │                                      └─ reads key from Secrets Manager at cold start
 *                          └─ else ──► CloudFront function (/dashboard → /index.html) ──► private S3 bucket
 */
export class FeedbackStack extends Stack {
  constructor(scope: Construct, id: string, props: FeedbackStackProps) {
    super(scope, id, props);

    // Created with a random placeholder; the real key is set out of band (see README), never in code or the template.
    const apiKey = new Secret(this, "LlmApiKey", {
      description: "API key for the extraction model",
    });

    const fn = new NodejsFunction(this, "Api", {
      entry: path.join(REPO_ROOT, "src/server/lambda.ts"),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, "pnpm-lock.yaml"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      // Up to two model calls of 15 s; API Gateway cuts off at 30 s anyway.
      timeout: Duration.seconds(29),
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        LLM_PROVIDER: "openai",
        LLM_BASE_URL: "https://api.groq.com/openai/v1",
        LLM_MODEL: "openai/gpt-oss-20b",
        LLM_API_KEY_SECRET_ID: apiKey.secretArn,
      },
      logGroup: new LogGroup(this, "ApiLogs", {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: {
        minify: true,
        sourceMap: true,
        format: OutputFormat.ESM, // lambda.ts reads the secret with top-level await
        target: "node24",
        // Some dependencies still call require(); ESM bundles need it defined.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
        // The Node runtime ships AWS SDK v3, so it stays out of the bundle (the default, made explicit).
        externalModules: ["@aws-sdk/*"],
      },
    });
    apiKey.grantRead(fn);

    // Traffic goes to the alias, never to $LATEST, so CodeDeploy can shift it between versions.
    const live = new Alias(this, "Live", {
      aliasName: "live",
      version: fn.currentVersion,
    });

    // Errors here are crashes, timeouts and failed cold starts (e.g. bad config or unreadable secret).
    // Handled API errors, including 503 model outages, are responses, not Lambda errors.
    const errors = live
      .metricErrors({ period: Duration.minutes(1) })
      .createAlarm(this, "LiveErrors", {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        alarmDescription:
          "Lambda errors on the live alias; rolls back an in-progress deployment.",
      });

    // A new version takes traffic per deploymentConfig; if the alarm fires meanwhile, CodeDeploy rolls back.
    new LambdaDeploymentGroup(this, "ApiDeployment", {
      alias: live,
      deploymentConfig: props.deploymentConfig,
      alarms: [errors],
    });

    const api = new HttpApi(this, "HttpApi", { createDefaultStage: true });
    api.addRoutes({
      path: "/api/{proxy+}",
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ApiIntegration", live),
    });

    const site = new Bucket(this, "Site", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Client-side pages (/dashboard) have no file in S3: serve index.html for any path without an extension.
    // Done per request, not with distribution error pages, which would also rewrite API 404s.
    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) {
          var request = event.request;
          if (!request.uri.includes(".")) request.uri = "/index.html";
          return request;
        }`,
      ),
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: spaRewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "/api/*": {
          // apiEndpoint is https://<id>.execute-api.<region>.amazonaws.com; the origin needs the host only.
          origin: new HttpOrigin(Fn.select(2, Fn.split("/", api.apiEndpoint)), {
            readTimeout: Duration.seconds(30),
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // Uploads the built UI (pnpm build:web) and invalidates the CDN cache.
    new BucketDeployment(this, "SiteDeployment", {
      sources: [Source.asset(path.join(REPO_ROOT, "dist/web"))],
      destinationBucket: site,
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "Url", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "ApiKeySecretName", { value: apiKey.secretName });
  }
}

import { App } from "aws-cdk-lib";
import { LambdaDeploymentConfig } from "aws-cdk-lib/aws-codedeploy";
import { FeedbackStack } from "./stack.ts";

const app = new App();

// One stack per environment, each in its own account. Promotion deploys the same
// synthesised template to the next account; account IDs come from the environment.
new FeedbackStack(app, "FeedbackIntake-dev", {
  env: { account: process.env.DEV_ACCOUNT_ID, region: "eu-west-1" },
  deploymentConfig: LambdaDeploymentConfig.ALL_AT_ONCE,
});

new FeedbackStack(app, "FeedbackIntake-prod", {
  env: { account: process.env.PROD_ACCOUNT_ID, region: "eu-west-1" },
  // 10% of traffic for 5 minutes, then all of it; the error alarm rolls back during the window.
  deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
});

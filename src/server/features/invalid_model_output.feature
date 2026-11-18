Feature: The model returns output that does not satisfy the contract

  Scenario Outline: Invalid model output is rejected and nothing is stored
    Given the model returns <output> on every attempt
    When I submit valid feedback
    Then the response status is 502 with error code "EXTRACTION_INVALID"
    And the model was called 2 times
    And no record is stored

    Examples:
      | output                                  |
      | text that is not JSON                   |
      | JSON missing the "severity" field       |
      | a "category" outside the allowed values |

  Scenario: The model recovers on the repair retry
    Given the model returns invalid output first and a valid extraction second
    When I submit valid feedback
    Then the response status is 201
    And the model was called 2 times

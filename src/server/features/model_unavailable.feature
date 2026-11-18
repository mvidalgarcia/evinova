Feature: The model is unavailable

  Scenario Outline: An unavailable model is not retried and nothing is stored
    Given the model provider fails with <failure>
    When I submit valid feedback
    Then the response status is 503 with error code "MODEL_UNAVAILABLE"
    And the model was called 1 time
    And no record is stored

    Examples:
      | failure         |
      | a timeout       |
      | a 429 response  |
      | a 500 response  |
      | a network error |

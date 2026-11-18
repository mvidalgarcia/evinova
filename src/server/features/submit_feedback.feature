Feature: Submit feedback

  Scenario: A valid submission produces a conforming record
    Given the model returns a valid extraction that also contains "id" and "status" values
    When I submit valid feedback
    Then the response status is 201
    And the response body satisfies the FeedbackRecord contract
    And the id, submittedAt and status are server-generated, not taken from the model

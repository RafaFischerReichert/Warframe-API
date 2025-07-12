// Integration tests - these test the entire application as a whole
// This file should be placed in the `tests/` directory at the same level as `src/`

use app; // This imports the library crate

#[test]
fn test_library_integration() {
    // Test that we can use functions from the library
    assert_eq!(app::utils::factorial(5), 120);
    assert!(app::utils::is_prime(17));
    assert_eq!(app::utils::to_uppercase("hello"), "HELLO");
}

#[test]
fn test_user_integration() {
    let user = app::data::User::new(
        1,
        "Integration Test User".to_string(),
        "integration@test.com".to_string(),
    );
    
    assert!(user.is_valid_email());
    assert_eq!(user.name, "Integration Test User");
}

#[test]
fn test_json_integration() {
    use serde_json::json;
    
    let user = app::data::User::new(
        1,
        "JSON Test User".to_string(),
        "json@test.com".to_string(),
    );
    
    // Test serialization
    let json_string = serde_json::to_string(&user).unwrap();
    assert!(json_string.contains("JSON Test User"));
    assert!(json_string.contains("json@test.com"));
    
    // Test deserialization
    let parsed_user: app::data::User = serde_json::from_str(&json_string).unwrap();
    assert_eq!(user.id, parsed_user.id);
    assert_eq!(user.name, parsed_user.name);
    assert_eq!(user.email, parsed_user.email);
}

#[test]
fn test_error_handling_integration() {
    // Test that invalid JSON is handled properly
    let invalid_json = r#"{"id": "not_a_number", "name": "test"}"#;
    let result: Result<app::data::User, _> = serde_json::from_str(invalid_json);
    assert!(result.is_err());
}

#[test]
fn test_multiple_operations_integration() {
    // Test a more complex scenario involving multiple operations
    let users = vec![
        app::data::User::new(1, "Alice".to_string(), "alice@example.com".to_string()),
        app::data::User::new(2, "Bob".to_string(), "bob@example.com".to_string()),
        app::data::User::new(3, "Charlie".to_string(), "charlie@example.com".to_string()),
    ];
    
    // Test that all users have valid emails
    for user in &users {
        assert!(user.is_valid_email());
    }
    
    // Test serialization of the entire list
    let json_string = serde_json::to_string(&users).unwrap();
    let parsed_users: Vec<app::data::User> = serde_json::from_str(&json_string).unwrap();
    
    assert_eq!(users.len(), parsed_users.len());
    for (original, parsed) in users.iter().zip(parsed_users.iter()) {
        assert_eq!(original.id, parsed.id);
        assert_eq!(original.name, parsed.name);
        assert_eq!(original.email, parsed.email);
    }
} 
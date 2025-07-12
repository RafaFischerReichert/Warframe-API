// Common test utilities and setup code
// This module can be used by multiple test files

use app::data::User;

/// Create a test user with default values
pub fn create_test_user() -> User {
    User::new(
        1,
        "Test User".to_string(),
        "test@example.com".to_string(),
    )
}

/// Create multiple test users
pub fn create_test_users(count: usize) -> Vec<User> {
    (1..=count)
        .map(|i| User::new(
            i as u32,
            format!("User {}", i),
            format!("user{}@example.com", i),
        ))
        .collect()
}

/// Assert that a user has valid data
pub fn assert_valid_user(user: &User) {
    assert!(user.id > 0);
    assert!(!user.name.is_empty());
    assert!(user.is_valid_email());
}

/// Test data for JSON operations
pub fn get_test_json_data() -> serde_json::Value {
    serde_json::json!({
        "users": [
            {
                "id": 1,
                "name": "Alice",
                "email": "alice@example.com"
            },
            {
                "id": 2,
                "name": "Bob",
                "email": "bob@example.com"
            }
        ],
        "metadata": {
            "total_count": 2,
            "version": "1.0"
        }
    })
}

/// Setup function that can be called before tests
pub fn setup_test_environment() {
    // This could include setting up test databases, mock services, etc.
    println!("Setting up test environment...");
}

/// Cleanup function that can be called after tests
pub fn cleanup_test_environment() {
    // This could include cleaning up test data, closing connections, etc.
    println!("Cleaning up test environment...");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_test_user() {
        let user = create_test_user();
        assert_valid_user(&user);
        assert_eq!(user.id, 1);
        assert_eq!(user.name, "Test User");
        assert_eq!(user.email, "test@example.com");
    }

    #[test]
    fn test_create_test_users() {
        let users = create_test_users(3);
        assert_eq!(users.len(), 3);
        
        for (i, user) in users.iter().enumerate() {
            assert_eq!(user.id, (i + 1) as u32);
            assert_eq!(user.name, format!("User {}", i + 1));
            assert_eq!(user.email, format!("user{}@example.com", i + 1));
            assert_valid_user(user);
        }
    }

    #[test]
    fn test_get_test_json_data() {
        let data = get_test_json_data();
        assert!(data["users"].is_array());
        assert_eq!(data["users"].as_array().unwrap().len(), 2);
        assert_eq!(data["metadata"]["total_count"], 2);
        assert_eq!(data["metadata"]["version"], "1.0");
    }
} 
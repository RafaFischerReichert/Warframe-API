// Library module for shared functionality

/// Utility functions for the application
pub mod utils {
    /// Calculate the factorial of a number
    pub fn factorial(n: u64) -> u64 {
        if n <= 1 {
            1
        } else {
            n * factorial(n - 1)
        }
    }

    /// Check if a number is prime
    pub fn is_prime(n: u64) -> bool {
        if n < 2 {
            return false;
        }
        if n == 2 {
            return true;
        }
        if n % 2 == 0 {
            return false;
        }
        
        let sqrt_n = (n as f64).sqrt() as u64;
        for i in (3..=sqrt_n).step_by(2) {
            if n % i == 0 {
                return false;
            }
        }
        true
    }

    /// Convert a string to uppercase
    pub fn to_uppercase(input: &str) -> String {
        input.to_uppercase()
    }

    /// Add two numbers (moved from main.rs)
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }

    /// Greet a user (moved from main.rs)
    pub fn greet(name: &str) -> String {
        format!("Hello, {}!", name)
    }

    /// Parse a JSON string (moved from main.rs)
    pub fn parse_json(json_str: &str) -> Result<serde_json::Value, serde_json::Error> {
        serde_json::from_str(json_str)
    }
}

/// Data structures for the application
pub mod data {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct User {
        pub id: u32,
        pub name: String,
        pub email: String,
    }

    impl User {
        pub fn new(id: u32, name: String, email: String) -> Self {
            Self { id, name, email }
        }

        pub fn is_valid_email(&self) -> bool {
            self.email.contains('@') && self.email.contains('.')
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_factorial() {
        assert_eq!(utils::factorial(0), 1);
        assert_eq!(utils::factorial(1), 1);
        assert_eq!(utils::factorial(5), 120);
        assert_eq!(utils::factorial(10), 3628800);
    }

    #[test]
    fn test_is_prime() {
        assert!(!utils::is_prime(0));
        assert!(!utils::is_prime(1));
        assert!(utils::is_prime(2));
        assert!(utils::is_prime(3));
        assert!(!utils::is_prime(4));
        assert!(utils::is_prime(5));
        assert!(!utils::is_prime(6));
        assert!(utils::is_prime(7));
        assert!(utils::is_prime(17));
        assert!(!utils::is_prime(25));
    }

    #[test]
    fn test_to_uppercase() {
        assert_eq!(utils::to_uppercase("hello"), "HELLO");
        assert_eq!(utils::to_uppercase("WORLD"), "WORLD");
        assert_eq!(utils::to_uppercase(""), "");
        assert_eq!(utils::to_uppercase("Hello World"), "HELLO WORLD");
    }

    #[test]
    fn test_add() {
        assert_eq!(utils::add(2, 3), 5);
        assert_eq!(utils::add(-1, 1), 0);
        assert_eq!(utils::add(0, 0), 0);
    }

    #[test]
    fn test_greet() {
        assert_eq!(utils::greet("World"), "Hello, World!");
        assert_eq!(utils::greet("Rust"), "Hello, Rust!");
        assert_eq!(utils::greet(""), "Hello, !");
    }

    #[test]
    fn test_parse_json() {
        // Test valid JSON
        let valid_json = r#"{"name": "test", "value": 42}"#;
        let result = utils::parse_json(valid_json);
        assert!(result.is_ok());
        
        let parsed = result.unwrap();
        assert_eq!(parsed["name"], "test");
        assert_eq!(parsed["value"], 42);

        // Test invalid JSON
        let invalid_json = r#"{"name": "test", "value": 42"#;
        let result = utils::parse_json(invalid_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_serde_json_operations() {
        use serde_json::json;
        
        // Test creating JSON values
        let json_value = json!({
            "string": "hello",
            "number": 42,
            "boolean": true,
            "array": [1, 2, 3],
            "object": {
                "nested": "value"
            }
        });

        assert_eq!(json_value["string"], "hello");
        assert_eq!(json_value["number"], 42);
        assert_eq!(json_value["boolean"], true);
        assert_eq!(json_value["array"][0], 1);
        assert_eq!(json_value["object"]["nested"], "value");
    }

    #[test]
    fn test_user_creation() {
        let user = data::User::new(1, "John Doe".to_string(), "john@example.com".to_string());
        assert_eq!(user.id, 1);
        assert_eq!(user.name, "John Doe");
        assert_eq!(user.email, "john@example.com");
    }

    #[test]
    fn test_user_email_validation() {
        let valid_user = data::User::new(1, "John".to_string(), "john@example.com".to_string());
        assert!(valid_user.is_valid_email());

        let invalid_user = data::User::new(2, "Jane".to_string(), "invalid-email".to_string());
        assert!(!invalid_user.is_valid_email());
    }

    #[test]
    fn test_user_serialization() {
        let user = data::User::new(1, "Test User".to_string(), "test@example.com".to_string());
        let json = serde_json::to_string(&user).unwrap();
        let deserialized_user: data::User = serde_json::from_str(&json).unwrap();
        
        assert_eq!(user.id, deserialized_user.id);
        assert_eq!(user.name, deserialized_user.name);
        assert_eq!(user.email, deserialized_user.email);
    }
} 
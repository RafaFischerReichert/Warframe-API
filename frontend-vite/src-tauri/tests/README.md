# Rust Tests Documentation

This directory contains the test suite for the Rust application.

## Test Structure

### Unit Tests
- **`src/main.rs`** - Contains unit tests for the main application functions
- **`src/lib.rs`** - Contains unit tests for the library functions and data structures

### Integration Tests
- **`tests/integration_tests.rs`** - Tests that verify the entire application works together
- **`tests/common/mod.rs`** - Shared test utilities and helper functions

## Running Tests

### Run All Tests
```bash
cargo test
```

### Run Tests with Output
```bash
cargo test -- --nocapture
```

### Run Specific Test
```bash
cargo test test_name
```

### Run Tests in Parallel
```bash
cargo test -- --test-threads=4
```

### Run Tests with Coverage (requires cargo-tarpaulin)
```bash
cargo install cargo-tarpaulin
cargo tarpaulin
```

## Test Categories

### 1. Unit Tests
These test individual functions and methods in isolation:

- **Mathematical functions**: `factorial`, `is_prime`
- **String manipulation**: `to_uppercase`, `greet`
- **JSON parsing**: `parse_json`
- **Data structures**: `User` creation and validation

### 2. Integration Tests
These test how different parts of the application work together:

- **Library integration**: Testing that all library functions work correctly
- **JSON serialization**: Testing complete serialization/deserialization cycles
- **Error handling**: Testing how the application handles invalid data
- **Complex scenarios**: Testing multiple operations together

### 3. Common Test Utilities
Shared functions for creating test data and assertions:

- **`create_test_user()`**: Creates a standard test user
- **`create_test_users(count)`**: Creates multiple test users
- **`assert_valid_user(user)`**: Validates user data
- **`get_test_json_data()`**: Provides standard test JSON data

## Writing New Tests

### Unit Test Example
```rust
#[test]
fn test_my_function() {
    let result = my_function(5);
    assert_eq!(result, 10);
}
```

### Integration Test Example
```rust
#[test]
fn test_feature_integration() {
    use app::my_module;
    
    let data = my_module::process_data("test");
    assert!(data.is_valid());
}
```

### Using Common Utilities
```rust
#[test]
fn test_with_utilities() {
    use crate::common;
    
    let user = common::create_test_user();
    common::assert_valid_user(&user);
}
```

## Test Best Practices

1. **Test naming**: Use descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Test isolation**: Each test should be independent and not rely on other tests
4. **Edge cases**: Test boundary conditions and error scenarios
5. **Documentation**: Add comments to explain complex test logic

## Test Dependencies

The following dependencies are available for testing:

- **`tokio`**: For async testing (if needed)
- **`serde_json`**: For JSON testing utilities
- **`serde`**: For serialization testing

## Continuous Integration

Tests are automatically run in CI/CD pipelines. Make sure all tests pass before merging code changes.

## Debugging Tests

### Run Single Test with Debug Output
```bash
cargo test test_name -- --nocapture
```

### Run Tests with Backtrace
```bash
RUST_BACKTRACE=1 cargo test
```

### Run Tests in Debug Mode
```bash
cargo test --debug
``` 
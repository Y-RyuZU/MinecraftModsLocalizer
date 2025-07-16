use std::collections::HashMap;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::{serialize_json_sorted, sort_json_object};

    #[test]
    fn test_sort_json_object() {
        // Create a test JSON object with unsorted keys
        let mut map = serde_json::Map::new();
        map.insert(
            "zebra".to_string(),
            serde_json::Value::String("last".to_string()),
        );
        map.insert(
            "apple".to_string(),
            serde_json::Value::String("first".to_string()),
        );
        map.insert(
            "banana".to_string(),
            serde_json::Value::String("middle".to_string()),
        );

        let json_value = serde_json::Value::Object(map);

        // Sort the JSON object
        let sorted_value = sort_json_object(&json_value);

        // Verify the keys are sorted
        if let serde_json::Value::Object(sorted_map) = sorted_value {
            let keys: Vec<&String> = sorted_map.keys().collect();
            assert_eq!(keys, vec!["apple", "banana", "zebra"]);
        } else {
            panic!("Expected JSON object");
        }
    }

    #[test]
    fn test_sort_json_object_nested() {
        // Create a nested JSON object with unsorted keys
        let mut inner_map = serde_json::Map::new();
        inner_map.insert(
            "inner_z".to_string(),
            serde_json::Value::String("inner_z_val".to_string()),
        );
        inner_map.insert(
            "inner_a".to_string(),
            serde_json::Value::String("inner_a_val".to_string()),
        );

        let mut outer_map = serde_json::Map::new();
        outer_map.insert("outer_z".to_string(), serde_json::Value::Object(inner_map));
        outer_map.insert(
            "outer_a".to_string(),
            serde_json::Value::String("outer_a_val".to_string()),
        );

        let json_value = serde_json::Value::Object(outer_map);

        // Sort the JSON object
        let sorted_value = sort_json_object(&json_value);

        // Verify the outer keys are sorted
        if let serde_json::Value::Object(sorted_map) = sorted_value {
            let keys: Vec<&String> = sorted_map.keys().collect();
            assert_eq!(keys, vec!["outer_a", "outer_z"]);

            // Verify the inner keys are sorted
            if let Some(serde_json::Value::Object(inner_sorted)) = sorted_map.get("outer_z") {
                let inner_keys: Vec<&String> = inner_sorted.keys().collect();
                assert_eq!(inner_keys, vec!["inner_a", "inner_z"]);
            } else {
                panic!("Expected nested JSON object");
            }
        } else {
            panic!("Expected JSON object");
        }
    }

    #[test]
    fn test_serialize_json_sorted() {
        // Create a test HashMap with unsorted keys
        let mut content = HashMap::new();
        content.insert("zebra.item".to_string(), "Zebra Item".to_string());
        content.insert("apple.block".to_string(), "Apple Block".to_string());
        content.insert("banana.tool".to_string(), "Banana Tool".to_string());

        // Serialize with sorted keys
        let result = serialize_json_sorted(&content).unwrap();

        // Parse back to verify ordering
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        if let serde_json::Value::Object(map) = parsed {
            let keys: Vec<&String> = map.keys().collect();
            assert_eq!(keys, vec!["apple.block", "banana.tool", "zebra.item"]);
        } else {
            panic!("Expected JSON object");
        }

        // Verify that the JSON string has the keys in sorted order
        assert!(result.find("apple.block").unwrap() < result.find("banana.tool").unwrap());
        assert!(result.find("banana.tool").unwrap() < result.find("zebra.item").unwrap());
    }
}

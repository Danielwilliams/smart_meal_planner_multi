# Shopping List Test Page

A dedicated test page has been created to help you test and debug the AI shopping list functionality directly in the application.

## How to Access the Test Page

Navigate to the following URL in your browser:

```
https://your-app-domain/debug/shopping-list-test
```

## Testing Features

The test page provides several ways to test the AI shopping list functionality:

### 1. Testing with a Real Menu

1. Enter a menu ID in the "Menu ID" field
2. (Optional) Add any additional preferences or context for the AI
3. Choose whether to use the cache or not
4. Click "Test API" to get the shopping list from the API
5. Click "Regenerate" to force a fresh generation (clears cache)

### 2. Testing with Custom Ingredients

If you don't have a specific menu ID or want to test with custom ingredients:

1. Enter ingredients in the text area (one per line)
2. Use the sample ingredient buttons for quick testing
3. Click "Client-Side Processing" to process the ingredients locally

### 3. Viewing Results

The results are displayed in three tabs:

1. **Shopping List Tab**: See the formatted shopping list as it would appear in the app
2. **Raw Data Tab**: Examine the raw JSON response to debug data structure issues
3. **Tips & Alternatives Tab**: View recommendations, nutrition tips, shopping tips, and healthy alternatives

## Troubleshooting Specific Issues

### Testing Cache Behavior

1. Enter a menu ID
2. Turn ON the "Use Cache" switch
3. Click "Test API" to get the initial result
4. Click "Test API" again to verify you get the cached result
5. Turn OFF the "Use Cache" switch
6. Click "Test API" again to verify you get a fresh result

### Testing the Healthy Alternatives Feature

1. Process a shopping list using any method
2. Go to the "Tips & Alternatives" tab
3. Verify that the "Healthy Alternatives" section shows the expected alternatives

### Testing Shopping Tips

1. Process a shopping list using any method
2. Go to the "Tips & Alternatives" tab
3. Verify that the "Shopping Tips" section displays useful shopping advice

## Feedback and Improvements

As you use the test page, take note of any issues or improvements needed in the AI shopping list functionality.

Key areas to evaluate:

1. Format of shopping list items ("Item: Quantity-Unit")
2. Quality and relevance of healthy alternatives
3. Usefulness of shopping tips
4. Performance of regeneration functionality
5. Item categorization accuracy

This test page is designed to help isolate and identify problems in the shopping list feature, so you can make targeted improvements to the core functionality.
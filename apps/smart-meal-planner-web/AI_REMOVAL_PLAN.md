# AI Shopping List Removal Plan

This document catalogs all AI-related functionality in `ShoppingListPage.jsx` that needs to be removed.

## 1. Imports to Remove

### Line 49: AI Adapter Import
```javascript
import { adaptShoppingListResponse } from '../utils/aiShoppingListAdapter';
```

### Line 51: AI Icon Import
```javascript
AutoAwesome as AiIcon,
```

### Line 58: Duplicate AutoAwesome Import
```javascript
AutoAwesome,
```

## 2. State Variables to Remove

### Lines 103-105, 111-112: AI State Variables
```javascript
const [showAiShoppingPrompt, setShowAiShoppingPrompt] = useState(false);
const [aiShoppingLoading, setAiShoppingLoading] = useState(false);
const [aiShoppingData, setAiShoppingData] = useState(null);
const [aiPreferences, setAiPreferences] = useState('');
const [usingAiList, setUsingAiList] = useState(false);
```

## 3. Constants to Remove

### Line 141: AI Cache Key
```javascript
const AI_SHOPPING_CACHE_KEY = 'ai_shopping_cache';
```

## 4. Loading Messages to Remove

### Lines 114-140: AI Loading Messages Array
```javascript
// Default to AI Enhanced tab (index 1)
// For New AI List button - ensure these are still accessible
const loadingMessages = [
  "AI chef is chopping ingredients into categories...",
  "Analyzing nutritional content and suggesting healthy swaps...",
  "Cross-referencing with dietary preferences...",
  "Organizing items by store layout for efficient shopping...",
  "Adding personalized recommendations based on your menu...",
  "Calculating optimal quantities to minimize waste...",
  "Checking for pantry staples you might already have...",
  "Finalizing your smart shopping list...",
  "Almost ready! Adding finishing touches...",
  "Your AI-enhanced shopping list is ready!"
];
```

## 5. Functions to Remove

### Lines 1070-1230: processAiShoppingItems Function
```javascript
const processAiShoppingItems = (response) => {
  // Large function that processes AI shopping list data
  // Contains complex logic for handling AI responses
}
```

### Lines 1234-1740: generateNewAiList Function
```javascript
const generateNewAiList = async () => {
  // Massive function (500+ lines) that generates AI shopping lists
  // Contains polling logic, API calls, caching
}
```

### Lines 1742-1870: generateCategorizedShoppingList Function
```javascript
const generateCategorizedShoppingList = async () => {
  // Function for generating categorized shopping lists via AI
}
```

### Lines 2147-2370: checkAiShoppingListStatus Function
```javascript
const checkAiShoppingListStatus = async (menuId) => {
  // Function for polling AI shopping list status
}
```

### Lines 2798-3120: loadAiShoppingList Function
```javascript
const loadAiShoppingList = async (menuId, forceRefresh = false) => {
  // Function for loading AI shopping lists with caching
}
```

### Lines 3126-3270: handleAiPromptResponse Function
```javascript
const handleAiPromptResponse = async (useAi) => {
  // Handler for AI prompt dialog responses
}
```

## 6. useEffect Dependencies to Update

### Lines 2736: AI Loading Effect
Remove `aiShoppingLoading` and `aiShoppingData` from useEffect dependencies

### Lines 3275-3340: Menu Change Effect
Remove AI-related logic from the menu change useEffect:
- Remove `setActiveTab(1)` (AI tab switching)
- Remove automatic AI list generation
- Remove AI cache checking logic

## 7. UI Components to Remove

### Lines 4233-4236: AI Enhanced Tab
```javascript
<Tab
  icon={<AiIcon />}
  label="AI Enhanced"
  id="tab-1"
  aria-controls="tabpanel-1"
/>
```

### Lines 4245-4260: AI Regenerate Button
```javascript
{/* Refresh button to regenerate AI shopping list */}
<Button
  variant="outlined"
  color="primary"
  startIcon={aiShoppingLoading ? <CircularProgress size={20} /> : <AiIcon />}
  onClick={() => {
    console.log("SIMPLE EMERGENCY FIX: Regenerate AI List button clicked");
    generateNewAiList();
    // Switch to AI tab
    setActiveTab(1);
  }}
  disabled={aiShoppingLoading}
  sx={{ ml: 2 }}
>
  Regenerate AI List
</Button>
```

### Lines 4424-4815: Entire AI Enhanced Tab Panel
```javascript
{/* AI Enhanced List Tab Panel */}
<div
  role="tabpanel"
  hidden={activeTab !== 1}
  id="tabpanel-1"
  aria-labelledby="tab-1"
>
  {/* Massive AI tab content including:
    - Loading indicators
    - Generate AI List button
    - AI shopping data display
    - AI tips and recommendations
    - AI categorized shopping list
  */}
</div>
```

### Lines 4864-4927: AI Shopping List Prompt Dialog
```javascript
{/* AI Shopping List Prompt Dialog */}
<Dialog
  open={showAiShoppingPrompt}
  onClose={() => setShowAiShoppingPrompt(false)}
  // Dialog content for AI prompt
>
  // Dialog content
</Dialog>
```

## 8. Tab Index Updates Required

After removing the AI Enhanced tab (index 1), update:

### By Meal Tab References
- Change `id="tab-2"` to `id="tab-1"`
- Change `aria-controls="tabpanel-2"` to `aria-controls="tabpanel-1"`

### By Meal Tab Panel References  
- Change `hidden={activeTab !== 2}` to `hidden={activeTab !== 1}`
- Change `id="tabpanel-2"` to `id="tabpanel-1"`
- Change `aria-labelledby="tab-2"` to `aria-labelledby="tab-1"`

## 9. Comments to Remove

Search for and remove comments containing:
- "AI" 
- "ai"
- References to AI functionality

## 10. API Calls to Remove

Remove calls to:
- `apiService.generateAiShoppingList()`
- `apiService.getAiShoppingListStatus()`
- AI-specific fetch requests to `/ai-shopping-list` endpoints

## 11. Window Variables to Remove

Remove global window variables:
- `window.aiStatusCurrentlyPolling`
- `window.aiStatusPollingTimeout`

## 12. Local Storage Keys to Remove

Remove usage of:
- `AI_SHOPPING_CACHE_KEY`
- AI cache-related localStorage operations

## 13. Conditional Logic to Remove

Remove conditional checks for:
- `aiShoppingData`
- `aiShoppingLoading` 
- `usingAiList`
- AI-related state variables

## Implementation Strategy

1. **Phase 1**: Remove imports and constants
2. **Phase 2**: Remove state variables
3. **Phase 3**: Remove large functions (in order of dependencies)
4. **Phase 4**: Remove UI components and update tab references
5. **Phase 5**: Clean up remaining references and comments
6. **Phase 6**: Test compilation and functionality

## Expected Result

After removal:
- Only 2 tabs: "Standard" (index 0) and "By Meal" (index 1)
- No AI-related functionality or UI
- Significantly reduced file size (from ~5000 lines to ~3000 lines estimated)
- Clean, maintainable code focused on standard and meal-based shopping lists
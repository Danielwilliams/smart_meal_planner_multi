# Phase 3: Menu & Recipe Management - Implementation Gameplan

## 🎯 Overview
Building on the completed Phase 1 (Client Management) and Phase 2 (Business Information), Phase 3 focuses on giving organizations complete control over their menu offerings, recipe libraries, and nutritional standards.

## 🏗️ Current State Analysis

### ✅ Already Implemented
- **RecipeAdminPanel.jsx** - Recipe management interface exists
- **Shared Menus Tab** - Basic shared menu functionality in OrganizationDashboard
- **Client Recipes Tab** - Client-specific recipe management
- **Recipe Browser** - RecipeBrowserPage.jsx for recipe discovery
- **Custom Menu Builder** - CustomMenuBuilderPage.jsx for menu creation

### 🔄 Needs Enhancement/Organization-Specific Features
- Organization-specific recipe libraries
- Default menu parameters for client deliverables  
- Nutritional standards and compliance
- Menu approval workflows
- Recipe categorization and tagging for organizations

## 📋 Phase 3 Feature Breakdown

### 1. Organization Recipe Library Management 📚

**Frontend Components Needed:**
- **OrganizationRecipeLibrary.jsx** - Main recipe library interface
- Enhance existing **RecipeAdminPanel.jsx** for organization context
- Recipe import/export tools
- Bulk recipe operations

**Backend API Enhancements:**
- `/api/organizations/{org_id}/recipes/` - Organization-scoped recipe CRUD
- Recipe approval workflow endpoints
- Recipe categorization and tagging system
- Import/export endpoints for recipe data

**Database Schema:**
```sql
CREATE TABLE organization_recipes (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    recipe_id INTEGER REFERENCES recipes(id),
    is_approved BOOLEAN DEFAULT FALSE,
    category VARCHAR(100),
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES user_profiles(id),
    approved_at TIMESTAMP
);

CREATE TABLE organization_recipe_categories (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- hex color code
    sort_order INTEGER DEFAULT 0,
    UNIQUE(organization_id, name)
);
```

**Key Features:**
- ✅ Curated recipe collections per organization
- ✅ Recipe approval workflow (pending → approved → published)
- ✅ Custom categorization (breakfast, lunch, dinner, snacks, special diets)
- ✅ Tag system for dietary restrictions, cooking methods, ingredients
- ✅ Nutritional compliance checking
- ✅ Recipe import from existing databases
- ✅ Bulk operations (approve multiple, categorize multiple)

### 2. Default Menu Parameters ⚙️

**Frontend Enhancement:**
- Add new tab to **OrganizationSettingsPage.jsx**: "Menu Defaults"
- Menu parameter configuration interface
- Preview system for default menu layouts

**Backend API:**
- Extend `organization_settings.py` with menu parameter endpoints
- Menu template system

**Configuration Options:**
```javascript
menuDefaults: {
  planningPeriod: 7, // days
  mealsPerDay: 3,
  includeSnacks: true,
  snacksPerDay: 1,
  servingSizes: {
    breakfast: 1,
    lunch: 1, 
    dinner: 1,
    snacks: 1
  },
  nutritionalTargets: {
    caloriesPerMeal: { min: 300, max: 800 },
    proteinPercentage: { min: 15, max: 35 },
    carbsPercentage: { min: 45, max: 65 },
    fatPercentage: { min: 20, max: 35 }
  },
  dietaryDefaults: {
    allowedCuisines: ['american', 'italian', 'mexican'],
    restrictedIngredients: [],
    preferredCookingMethods: ['baking', 'grilling', 'sautéing'],
    maxPrepTime: 45 // minutes
  },
  clientDeliverySettings: {
    requireApproval: true,
    autoGenerateShoppingList: true,
    includeNutritionalInfo: true,
    includePrepInstructions: true
  }
}
```

### 3. Nutritional Standards & Guidelines 🥗

**Frontend Components:**
- **NutritionalStandardsManager.jsx** - Define org nutrition guidelines
- Integration with menu generation to enforce standards
- Compliance dashboard showing how menus meet standards

**Backend Infrastructure:**
- Nutritional analysis API endpoints
- Standards validation during menu generation
- Compliance reporting

**Standards Categories:**
- **Caloric Guidelines**: Daily/per-meal calorie targets by client type
- **Macronutrient Ratios**: Protein/carb/fat percentages by goal (weight loss, maintenance, gain)
- **Micronutrient Requirements**: Essential vitamins/minerals tracking
- **Dietary Compliance**: Allergen management, religious restrictions, medical needs
- **Portion Control**: Serving size standards by food group
- **Quality Standards**: Whole foods vs processed, organic preferences, local sourcing

### 4. Menu Approval Workflow 📋

**Frontend Components:**
- **MenuApprovalDashboard.jsx** - Queue of menus pending approval
- **MenuReviewInterface.jsx** - Detailed review with nutrition analysis
- Approval notification system

**Backend API:**
- Menu approval workflow endpoints
- Notification system for approvals/rejections
- Audit trail for menu changes

**Workflow States:**
1. **Draft** - Menu created, needs review
2. **Pending Approval** - Submitted for organization review
3. **Approved** - Ready for client delivery
4. **Needs Revision** - Requires changes before approval
5. **Published** - Active and delivered to client
6. **Archived** - Completed/historical menus

## 🗂️ New Organization Dashboard Tab Structure

Enhance the existing **OrganizationDashboard.jsx** with menu management:

```javascript
// Add new tab to existing 7 tabs
<Tab label="Menu Management" icon={<RestaurantMenuIcon />} />

// Tab content with sub-navigation
menuManagementSubTabs: [
  "Recipe Library",      // Organization's approved recipes
  "Menu Templates",      // Pre-built menu templates
  "Approval Queue",      // Menus awaiting approval
  "Nutritional Standards", // Org nutrition guidelines
  "Menu Analytics"       // Performance metrics
]
```

## 📱 Enhanced Organization Settings

Add **Menu Defaults** tab to **OrganizationSettingsPage.jsx**:

```javascript
// Existing tabs: Default Client Preferences, Organization Info, Client Management
// Add: Menu Defaults

settingsTabs: [
  "Default Client Preferences",
  "Organization Info", 
  "Client Management",
  "Menu Defaults",        // NEW - Phase 3
  "Nutritional Standards" // NEW - Phase 3
]
```

## 🛠️ Implementation Timeline

### Week 1: Foundation
- [ ] Database schema for organization recipes and categories
- [ ] Backend API endpoints for organization recipe management
- [ ] Database migration for menu defaults in organization settings

### Week 2: Recipe Library
- [ ] OrganizationRecipeLibrary.jsx component
- [ ] Recipe categorization and tagging system
- [ ] Recipe approval workflow backend
- [ ] Integration with existing RecipeAdminPanel

### Week 3: Menu Defaults & Standards
- [ ] Menu Defaults tab in OrganizationSettingsPage
- [ ] NutritionalStandardsManager.jsx component
- [ ] Default menu parameter configuration
- [ ] Nutritional guidelines enforcement in menu generation

### Week 4: Menu Approval Workflow
- [ ] MenuApprovalDashboard.jsx component
- [ ] Menu approval workflow implementation
- [ ] Client delivery integration with approved menus
- [ ] Menu analytics and reporting

### Week 5: Integration & Polish
- [ ] Integration testing across all components
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Documentation and training materials

## 🔌 Integration Points

### With Existing Systems
- **Client Management**: Approved menus automatically available to clients
- **Organization Settings**: Menu defaults applied to new client menu generation
- **Notifications**: Approval workflow notifications through existing system
- **Recipe Browser**: Organization recipes prominently featured
- **Custom Menu Builder**: Enhanced with organization templates and standards

### With External Services
- **Nutritional APIs**: Enhanced nutritional analysis for compliance checking
- **Shopping List Generation**: Organization-approved recipes optimize shopping lists
- **Grocery Store Integration**: Organization preferences influence store product selection

## 📊 Success Metrics

### Functionality Metrics
- Organizations can manage 500+ recipes in their library
- Menu approval workflow processes menus in <24 hours average
- 95%+ of generated menus meet nutritional standards
- Client satisfaction scores improve by 20% with curated menus

### User Experience Metrics
- Recipe library search and filter response time <2 seconds
- Menu approval interface usable on mobile devices
- 90%+ of organizations adopt custom nutritional standards
- Zero-training-required for basic recipe library management

## 🚀 Future Expansion (Phase 4+)

- **AI Menu Generation**: AI that learns organization preferences and standards
- **Client Feedback Loop**: Client ratings influence recipe approval and recommendations
- **Seasonal Menu Planning**: Automatic seasonal recipe rotation and planning
- **Cost Optimization**: Recipe selection optimized for ingredient cost and availability
- **White-label Customization**: Organization-specific branding on all menu materials
- **Advanced Analytics**: Deep insights into client preferences, nutritional compliance, and cost metrics

---

This gameplan builds naturally on the solid foundation of Phase 1 and 2, giving organizations complete control over their menu offerings while maintaining the excellent user experience established in the existing dashboard system.
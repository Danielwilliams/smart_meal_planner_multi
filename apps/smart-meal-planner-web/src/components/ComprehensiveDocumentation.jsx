import React from 'react';
import { Button } from '@mui/material';

const ComprehensiveDocumentation = () => {
  const openDocumentation = () => {
    const newWindow = window.open('', '_blank');
    const docHTML = `
      <html>
        <head>
          <title>Smart Meal Planner - Complete Documentation</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
              max-width: 1000px;
            }
            h1 { color: #1976d2; border-bottom: 3px solid #1976d2; padding-bottom: 15px; margin-bottom: 30px; }
            h2 { color: #1976d2; border-bottom: 2px solid #e3f2fd; padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; }
            h3 { color: #1565c0; margin-top: 25px; margin-bottom: 15px; }
            h4 { color: #0d47a1; margin-top: 20px; margin-bottom: 10px; }
            ul, ol { margin-left: 25px; }
            li { margin-bottom: 8px; }
            strong { color: #1976d2; }
            .feature-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #1976d2; margin: 15px 0; border-radius: 4px; }
            .warning { background: #fff3cd; padding: 12px; border-left: 4px solid #ffc107; margin: 15px 0; border-radius: 4px; }
            .tip { background: #d1ecf1; padding: 12px; border-left: 4px solid #17a2b8; margin: 15px 0; border-radius: 4px; }
            .error { background: #f8d7da; padding: 12px; border-left: 4px solid #dc3545; margin: 15px 0; border-radius: 4px; }
            code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
            .toc { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .toc a { color: #1976d2; text-decoration: none; }
            .toc a:hover { text-decoration: underline; }
            .section { margin-bottom: 40px; }
          </style>
        </head>
        <body>
          <h1>🍽️ Smart Meal Planner - Complete Documentation</h1>
          
          <div class="toc">
            <h3>📋 Table of Contents</h3>
            <ul>
              <li><a href="#quick-start">Quick Start Guide</a></li>
              <li><a href="#organization-features">Organization Features</a></li>
              <li><a href="#client-management">Client Management</a></li>
              <li><a href="#menu-generation">Menu Generation & AI</a></li>
              <li><a href="#recipe-management">Recipe Management</a></li>
              <li><a href="#shopping-integration">Shopping Integration</a></li>
              <li><a href="#branding">White-Label Branding</a></li>
              <li><a href="#troubleshooting">Troubleshooting</a></li>
              <li><a href="#support">Support & Training</a></li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="quick-start">🚀 Quick Start Guide</h2>
            <div class="feature-box">
              <strong>For Organizations/Coaches:</strong>
              <ol>
                <li><strong>Organization Setup</strong>: Complete your profile in Settings tab with business info and defaults</li>
                <li><strong>Branding Configuration</strong>: Set up custom colors, logos, and messaging for your clients</li>
                <li><strong>Create Onboarding Forms</strong>: Design custom intake forms to understand client needs</li>
                <li><strong>Build Recipe Library</strong>: Add and approve recipes for your organization</li>
                <li><strong>Invite First Client</strong>: Send invitation emails through the Invitations tab</li>
                <li><strong>Generate Client Menu</strong>: Create personalized meal plans for clients</li>
                <li><strong>Monitor Progress</strong>: Track client engagement and success metrics</li>
              </ol>
            </div>
            
            <div class="tip">
              <strong>💡 Pro Tip:</strong> Start with the Getting Started guide in your organization dashboard for an interactive walkthrough of all features.
            </div>
          </div>
          
          <div class="section">
            <h2 id="organization-features">🏢 Organization Features</h2>
            
            <h3>Organization Dashboard</h3>
            <p>Your central hub with 8 comprehensive tabs:</p>
            <ul>
              <li><strong>Getting Started</strong>: Interactive onboarding with progress tracking</li>
              <li><strong>Clients</strong>: Client overview, status tracking, and quick actions</li>
              <li><strong>Invitations</strong>: Email-based client invitation system</li>
              <li><strong>Shared Menus</strong>: Menu sharing management and analytics</li>
              <li><strong>Onboarding Forms</strong>: Custom form builder with 8 field types</li>
              <li><strong>Client Notes</strong>: Private documentation system with templates</li>
              <li><strong>Recipe Library</strong>: Organization recipe management with approval workflow</li>
              <li><strong>Settings</strong>: Organization profile and configuration</li>
            </ul>
            
            <h3>Default Client Preferences</h3>
            <p>Set organization-wide defaults for new clients including:</p>
            <ul>
              <li>Dietary preferences and restrictions</li>
              <li>Macro targets and calorie goals</li>
              <li>Meal timing preferences</li>
              <li>Cooking complexity levels</li>
              <li>Available appliances</li>
              <li>Flavor preferences and spice levels</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="client-management">👥 Client Management</h2>
            
            <h3>Client Invitation Process</h3>
            <ol>
              <li><strong>Send Invitation</strong>: Enter client email in Invitations tab</li>
              <li><strong>Client Receives Email</strong>: Invitation contains signup link with organization context</li>
              <li><strong>Client Registration</strong>: 3-step registration process with email verification</li>
              <li><strong>Automatic Setup</strong>: Client inherits organization default preferences</li>
              <li><strong>Onboarding Forms</strong>: Client completes custom intake forms</li>
            </ol>
            
            <h3>Client Profile Management</h3>
            <ul>
              <li><strong>Profile Tab</strong>: Basic information and onboarding form responses</li>
              <li><strong>Menus Tab</strong>: Generate and share personalized meal plans</li>
              <li><strong>Preferences Tab</strong>: Detailed dietary and nutritional preferences</li>
            </ul>
            
            <h3>Client Notes System</h3>
            <ul>
              <li><strong>Note Categories</strong>: General, consultation, preference, goal, observation</li>
              <li><strong>Priority Levels</strong>: Low, normal, high, urgent</li>
              <li><strong>Templates</strong>: Pre-built note templates for common scenarios</li>
              <li><strong>Search & Filter</strong>: Find notes by category, priority, or content</li>
              <li><strong>Tags</strong>: Organize notes with custom tags</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="menu-generation">🤖 Menu Generation & AI</h2>
            
            <h3>AI-Powered Meal Planning</h3>
            <ul>
              <li><strong>Personalized Generation</strong>: Based on client preferences, dietary restrictions, and goals</li>
              <li><strong>Duration Options</strong>: 1-7 day meal plans</li>
              <li><strong>Meal Types</strong>: Breakfast, lunch, dinner, and snacks</li>
              <li><strong>Serving Sizes</strong>: 1-10 servings per meal</li>
              <li><strong>Variety Assurance</strong>: AI ensures no meal repeats unless requested</li>
              <li><strong>Macro Targeting</strong>: Automatic nutritional goal alignment</li>
            </ul>
            
            <h3>Menu Customization</h3>
            <ul>
              <li><strong>Custom Menu Builder</strong>: Manually select recipes from saved collections</li>
              <li><strong>Recipe Substitution</strong>: Swap out individual meals in generated plans</li>
              <li><strong>Dietary Compliance</strong>: Automatic filtering for restrictions and preferences</li>
              <li><strong>Appliance Matching</strong>: Recipes matched to available cooking equipment</li>
            </ul>
            
            <h3>Menu Sharing</h3>
            <ul>
              <li><strong>Client Access</strong>: Share menus directly with clients</li>
              <li><strong>Public Links</strong>: Generate shareable links for menus</li>
              <li><strong>Print-Friendly</strong>: Optimized layouts for printing</li>
              <li><strong>Mobile Responsive</strong>: Access menus on any device</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="recipe-management">📚 Recipe Management</h2>
            
            <h3>Organization Recipe Library</h3>
            <div class="feature-box">
              <p><strong>4-Tab Interface:</strong></p>
              <ul>
                <li><strong>Recipe Library</strong>: Browse and search approved recipes</li>
                <li><strong>Approval Queue</strong>: Review and approve pending recipes</li>
                <li><strong>Categories</strong>: Organize recipes with color-coded categories</li>
                <li><strong>Analytics</strong>: Track most-used recipes and client preferences</li>
              </ul>
            </div>
            
            <h3>Recipe Approval Workflow</h3>
            <ul>
              <li><strong>Status Tracking</strong>: Draft, pending, approved, needs revision</li>
              <li><strong>Internal Notes</strong>: Private notes for organization use</li>
              <li><strong>Client Notes</strong>: Public notes visible to clients</li>
              <li><strong>Compliance Tracking</strong>: Ensure recipes meet nutritional standards</li>
              <li><strong>Usage Analytics</strong>: Track which recipes are most popular</li>
            </ul>
            
            <h3>Custom Recipe Creation</h3>
            <ul>
              <li><strong>Recipe Builder</strong>: Step-by-step ingredient and instruction input</li>
              <li><strong>Nutritional Calculation</strong>: Automatic macro and calorie computation</li>
              <li><strong>Diet Tags</strong>: Label recipes with dietary categories</li>
              <li><strong>Image Upload</strong>: Add photos to make recipes more appealing</li>
              <li><strong>Complexity Ratings</strong>: Set preparation difficulty levels</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="shopping-integration">🛒 Shopping Integration</h2>
            
            <h3>Instacart Integration</h3>
            <ul>
              <li><strong>Retailer Selection</strong>: Choose from thousands of stores nationwide</li>
              <li><strong>Product Matching</strong>: AI matches recipe ingredients to store products</li>
              <li><strong>Cart Building</strong>: One-click add all ingredients to Instacart cart</li>
              <li><strong>Delivery Options</strong>: Schedule delivery or pickup times</li>
              <li><strong>Price Comparison</strong>: See pricing across different retailers</li>
            </ul>
            
            <h3>Kroger Integration</h3>
            <ul>
              <li><strong>Store Locator</strong>: Find nearby Kroger locations</li>
              <li><strong>Pickup Service</strong>: Schedule convenient pickup times</li>
              <li><strong>Account Sync</strong>: Connect with existing Kroger account</li>
              <li><strong>Digital Coupons</strong>: Automatic coupon application</li>
              <li><strong>Loyalty Points</strong>: Earn rewards on purchases</li>
            </ul>
            
            <h3>Shopping List Features</h3>
            <ul>
              <li><strong>Categorized Lists</strong>: Organized by store section (produce, dairy, etc.)</li>
              <li><strong>Meal-Based Organization</strong>: See ingredients grouped by individual meals</li>
              <li><strong>Unit Standardization</strong>: Automatic conversion and combination of similar items</li>
              <li><strong>Print Options</strong>: Generate printable shopping lists</li>
              <li><strong>Mobile Access</strong>: Access lists on smartphone while shopping</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="branding">🎨 White-Label Branding</h2>
            
            <h3>Visual Branding</h3>
            <ul>
              <li><strong>Custom Colors</strong>: Primary and secondary color schemes</li>
              <li><strong>Logo Upload</strong>: Main logo, header logo, and favicon</li>
              <li><strong>Theme Generation</strong>: Automatic UI theming based on brand colors</li>
              <li><strong>Client Interface</strong>: Branded experience for all client-facing pages</li>
            </ul>
            
            <h3>Custom Messaging</h3>
            <ul>
              <li><strong>Welcome Messages</strong>: Personalized client onboarding messages</li>
              <li><strong>Taglines</strong>: Custom business taglines and descriptions</li>
              <li><strong>Email Templates</strong>: Branded invitation and notification emails</li>
              <li><strong>Footer Content</strong>: Custom contact information and links</li>
            </ul>
            
            <h3>Feature Control</h3>
            <ul>
              <li><strong>Feature Toggles</strong>: Enable/disable specific features for clients</li>
              <li><strong>Menu Customization</strong>: Control which navigation items are visible</li>
              <li><strong>Workflow Control</strong>: Customize client journey and available actions</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="troubleshooting">🔧 Troubleshooting</h2>
            
            <h3>Common Issues & Solutions</h3>
            
            <h4>🚫 Login & Authentication Issues</h4>
            <div class="error">
              <strong>Problem:</strong> Can't log in or session expires frequently
              <ul>
                <li><strong>Solution:</strong> Clear browser cache and cookies</li>
                <li><strong>Solution:</strong> Disable browser extensions that block scripts</li>
                <li><strong>Solution:</strong> Try incognito/private browsing mode</li>
                <li><strong>Solution:</strong> Check if email address is verified</li>
                <li><strong>Solution:</strong> Reset password if needed</li>
              </ul>
            </div>
            
            <h4>📧 Invitation Issues</h4>
            <div class="warning">
              <strong>Problem:</strong> Client invitation emails not being received
              <ul>
                <li><strong>Solution:</strong> Check client's spam/junk folder</li>
                <li><strong>Solution:</strong> Verify email address spelling is correct</li>
                <li><strong>Solution:</strong> Ask client to whitelist @smartmealplannerio.com</li>
                <li><strong>Solution:</strong> Resend invitation after 24 hours if still not received</li>
                <li><strong>Solution:</strong> Try alternative email address</li>
              </ul>
            </div>
            
            <h4>🛒 Shopping Integration Problems</h4>
            <div class="error">
              <strong>Problem:</strong> Instacart/Kroger integration not working
              <ul>
                <li><strong>Solution:</strong> Verify you're logged into the respective service</li>
                <li><strong>Solution:</strong> Clear browser cache and try again</li>
                <li><strong>Solution:</strong> Check if popup blockers are preventing new windows</li>
                <li><strong>Solution:</strong> Try using a different browser</li>
                <li><strong>Solution:</strong> Ensure your location services are enabled</li>
                <li><strong>Solution:</strong> Check that the service is available in your area</li>
              </ul>
            </div>
            
            <h4>🤖 Menu Generation Issues</h4>
            <div class="warning">
              <strong>Problem:</strong> AI menu generation failing or producing poor results
              <ul>
                <li><strong>Solution:</strong> Ensure client preferences are completely filled out</li>
                <li><strong>Solution:</strong> Check that dietary restrictions are clearly specified</li>
                <li><strong>Solution:</strong> Try reducing the number of days or meals requested</li>
                <li><strong>Solution:</strong> Clear very restrictive preferences that might be too limiting</li>
                <li><strong>Solution:</strong> Verify spice level and flavor preferences are set</li>
                <li><strong>Solution:</strong> Contact support if issues persist</li>
              </ul>
            </div>
            
            <h4>📱 Mobile & Browser Compatibility</h4>
            <div class="tip">
              <strong>Supported Browsers:</strong>
              <ul>
                <li>Chrome 90+ (Recommended)</li>
                <li>Firefox 88+</li>
                <li>Safari 14+</li>
                <li>Edge 90+</li>
              </ul>
              <strong>Note:</strong> Internet Explorer is not supported.
            </div>
            
            <h3>Performance Optimization</h3>
            <ul>
              <li><strong>Slow Loading:</strong> Clear browser cache, disable unnecessary extensions</li>
              <li><strong>Recipe Images:</strong> Use optimized images under 2MB for faster loading</li>
              <li><strong>Large Menus:</strong> Break down 7-day plans into smaller segments if experiencing issues</li>
              <li><strong>Network Issues:</strong> Check internet connection stability</li>
              <li><strong>Memory Issues:</strong> Close unused browser tabs and restart browser</li>
            </ul>
            
            <h3>Data & Privacy</h3>
            <ul>
              <li><strong>Data Export:</strong> Contact support for data export requests</li>
              <li><strong>Account Deletion:</strong> Use account settings or contact support</li>
              <li><strong>Client Data:</strong> All client data is encrypted and HIPAA-compliant</li>
              <li><strong>Backup:</strong> Regular automated backups ensure data safety</li>
              <li><strong>Privacy:</strong> Client notes and preferences are private to your organization</li>
            </ul>
          </div>
          
          <div class="section">
            <h2 id="support">📞 Support & Training</h2>
            
            <h3>Getting Help</h3>
            <div class="feature-box">
              <ul>
                <li><strong>Email Support:</strong> <a href="mailto:support@smartmealplannerio.com">support@smartmealplannerio.com</a></li>
                <li><strong>Training Sessions:</strong> <a href="mailto:daniel@smartmealplannerio.com">daniel@smartmealplannerio.com</a></li>
                <li><strong>Response Time:</strong> Within 24 hours on business days</li>
                <li><strong>Best Practice:</strong> Include screenshots and detailed description of issues</li>
              </ul>
            </div>
            
            <h3>Training Resources</h3>
            <ul>
              <li><strong>Onboarding Call:</strong> Free 30-minute setup session for new organizations</li>
              <li><strong>Feature Walkthrough:</strong> Detailed review of all platform capabilities</li>
              <li><strong>Best Practices Guide:</strong> Tips for successful client engagement</li>
              <li><strong>Advanced Features:</strong> Training on custom workflows and automation</li>
              <li><strong>Troubleshooting Sessions:</strong> Dedicated time to resolve specific issues</li>
            </ul>
            
            <h3>Updates & Roadmap</h3>
            <ul>
              <li><strong>Regular Updates:</strong> New features released monthly</li>
              <li><strong>Feature Requests:</strong> Submit requests via support email</li>
              <li><strong>Beta Testing:</strong> Join beta program for early access to new features</li>
              <li><strong>Announcements:</strong> Important updates sent via email</li>
              <li><strong>Version History:</strong> Track feature releases and improvements</li>
            </ul>
            
            <div class="tip">
              <strong>💡 Success Tip:</strong> The most successful organizations start with a small pilot group of 3-5 clients, master the workflow, then scale up systematically.
            </div>
          </div>
          
          <hr style="margin: 40px 0; border: none; border-top: 2px solid #e3f2fd;">
          <p style="text-align: center; color: #666; font-style: italic;">
            Last Updated: ${new Date().toLocaleDateString()} | Version 2.0<br>
            Smart Meal Planner - Professional Nutrition Management Platform
          </p>
        </body>
      </html>
    `;
    
    if (newWindow) {
      newWindow.document.write(docHTML);
      newWindow.document.close();
    } else {
      alert('Documentation popup was blocked. Please allow popups for this site and try again.');
    }
  };

  return (
    <Button
      variant="outlined"
      color="primary"
      onClick={openDocumentation}
    >
      View Documentation
    </Button>
  );
};

export default ComprehensiveDocumentation;
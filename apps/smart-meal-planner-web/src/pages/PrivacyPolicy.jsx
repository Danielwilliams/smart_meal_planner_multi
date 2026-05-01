import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

const PrivacyPolicy = () => {
  return (
    <>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Privacy Policy
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            Last Updated: {new Date().toLocaleDateString()}
          </Typography>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              1. Introduction
            </Typography>
            <Typography paragraph>
              Welcome to Smart Meal Planner. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our meal planning service, whether through our website, mobile application, or other platforms.
            </Typography>
            <Typography paragraph>
              Please read this Privacy Policy carefully. By using Smart Meal Planner, you consent to the collection and use of information in accordance with this policy.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              2. Information We Collect
            </Typography>
            <Typography variant="h6" gutterBottom>
              2.1 Personal Information
            </Typography>
            <Typography paragraph>
              We may collect personal information that you provide directly to us, including:
            </Typography>
            <Typography component="ul">
              <li>Name, email address, and other contact details</li>
              <li>Account credentials (username and password)</li>
              <li>Dietary preferences and restrictions</li>
              <li>Health information you choose to share (allergies, nutritional requirements, etc.)</li>
              <li>Demographic information</li>
              <li>Payment and billing information</li>
              <li>Feedback, survey responses, and customer support communications</li>
            </Typography>

            <Typography variant="h6" gutterBottom mt={2}>
              2.2 Usage and Technical Information
            </Typography>
            <Typography paragraph>
              When you use our services, we automatically collect certain information, including:
            </Typography>
            <Typography component="ul">
              <li>IP address and device information</li>
              <li>Browser type and settings</li>
              <li>Operating system</li>
              <li>Usage data (pages visited, features used, meal plans generated)</li>
              <li>Time and date of your visits</li>
              <li>Referring websites or applications</li>
              <li>Shopping preferences and purchase history</li>
            </Typography>

            <Typography variant="h6" gutterBottom mt={2}>
              2.3 Information from Third Parties
            </Typography>
            <Typography paragraph>
              We may receive information about you from third-party services if you choose to link them to your account, such as:
            </Typography>
            <Typography component="ul">
              <li>Grocery delivery services (Instacart, Kroger, Walmart)</li>
              <li>Social media platforms</li>
              <li>Payment processors</li>
              <li>Analytics providers</li>
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              3. How We Use Your Information
            </Typography>
            <Typography paragraph>
              We use the information we collect for various purposes, including to:
            </Typography>
            <Typography component="ul">
              <li>Provide, maintain, and improve our services</li>
              <li>Create and personalize meal plans based on your preferences</li>
              <li>Process transactions and manage your account</li>
              <li>Generate shopping lists and facilitate grocery ordering</li>
              <li>Send you service-related notifications</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Understand how users interact with our services to improve functionality</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Protect the rights and property of our company and users</li>
              <li>Comply with legal obligations</li>
              <li>Market our services to you (with your consent where required by law)</li>
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              4. How We Share Your Information
            </Typography>
            <Typography paragraph>
              We may share your information in the following circumstances:
            </Typography>

            <Typography variant="h6" gutterBottom>
              4.1 With Service Providers
            </Typography>
            <Typography paragraph>
              We share information with vendors, service providers, and contractors who perform services for us, such as payment processing, data analysis, email delivery, hosting, customer service, and marketing assistance.
            </Typography>

            <Typography variant="h6" gutterBottom>
              4.2 With Partner Grocery Services
            </Typography>
            <Typography paragraph>
              When you use our app to shop for groceries, we may share necessary information with partners like Instacart, Kroger, or Walmart to facilitate your orders. This information is shared according to their respective privacy policies as well.
            </Typography>

            <Typography variant="h6" gutterBottom>
              4.3 For Legal Reasons
            </Typography>
            <Typography paragraph>
              We may disclose your information if required to do so by law or in response to valid requests by public authorities. We may also share information to protect the rights, property, or safety of our company, our users, or others.
            </Typography>

            <Typography variant="h6" gutterBottom>
              4.4 With Your Consent
            </Typography>
            <Typography paragraph>
              We may share your information with third parties when you have given us your consent to do so.
            </Typography>

            <Typography variant="h6" gutterBottom>
              4.5 Business Transfers
            </Typography>
            <Typography paragraph>
              If we are involved in a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred as part of that transaction.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              5. Data Security
            </Typography>
            <Typography paragraph>
              We implement appropriate technical and organizational measures to protect the security of your personal information. However, please be aware that no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              6. Your Rights and Choices
            </Typography>
            <Typography paragraph>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </Typography>
            <Typography component="ul">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction or objection to processing</li>
              <li>Data portability</li>
              <li>Withdrawal of consent</li>
            </Typography>
            <Typography paragraph>
              To exercise these rights, please contact us using the details provided in the "Contact Us" section.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              7. Account Information
            </Typography>
            <Typography paragraph>
              You can update, correct, or delete certain account information at any time by logging into your account settings. If you cannot access or modify your information through your account, please contact us for assistance.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              8. Cookies and Tracking Technologies
            </Typography>
            <Typography paragraph>
              We use cookies and similar tracking technologies to collect information about your browsing activities and to remember your preferences. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              9. Children's Privacy
            </Typography>
            <Typography paragraph>
              Our Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe that your child has provided us with personal information, please contact us.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              10. International Data Transfers
            </Typography>
            <Typography paragraph>
              Your information may be transferred to, and processed in, countries other than the country in which you reside. These countries may have data protection laws that are different from the laws of your country. We take steps to ensure that your information receives an adequate level of protection in the countries in which we process it.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              11. Changes to This Privacy Policy
            </Typography>
            <Typography paragraph>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              12. Contact Us
            </Typography>
            <Typography paragraph>
              If you have any questions about this Privacy Policy, please contact us at:
            </Typography>
            <Typography paragraph>
              Email: privacy@smartmealplanner.com
            </Typography>
            <Typography paragraph>
              Postal Address: [Your Company Address]
            </Typography>
          </Box>
        </Paper>
      </Container>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
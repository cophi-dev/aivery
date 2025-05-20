import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="legal-content text-sm">
      <h2 className="text-xl font-bold mb-4">Privacy Policy</h2>
      
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
        <p className="mb-2">
          This Privacy Policy explains how Aivery collects, uses, and protects your personal information 
          when you use our fitness tracking application. We are committed to ensuring the privacy and protection of 
          your personal data in compliance with the General Data Protection Regulation (GDPR) and German data protection laws.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">2. Data Controller</h3>
        <p className="mb-2">
          Aivery<br />
          Brödermannsweg 77a<br />
          22453 Hamburg<br />
          Germany<br />
          Email: contact@aivery.com
        </p>
        <p className="mb-2">
          Data Protection Officer: Phillipp Zarindast
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">3. Information We Collect</h3>
        <p className="mb-2">We collect the following types of information:</p>
        <ul className="list-disc ml-6 mb-2">
          <li>Account information (name, email address)</li>
          <li>Profile information (age, gender, weight, height)</li>
          <li>Workout data (exercises, repetitions, weights)</li>
          <li>Usage data (how you interact with our application)</li>
          <li>Device information (device type, operating system)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">4. Legal Basis for Processing</h3>
        <p className="mb-2">We process your personal data on the following legal bases:</p>
        <ul className="list-disc ml-6 mb-2">
          <li>Performance of a contract (when you sign up for our service)</li>
          <li>Your consent (for optional features and marketing)</li>
          <li>Legitimate interests (improving our service)</li>
          <li>Legal obligations (such as tax and accounting requirements)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">5. How We Use Your Information</h3>
        <p className="mb-2">We use your information for the following purposes:</p>
        <ul className="list-disc ml-6 mb-2">
          <li>To provide and maintain our service</li>
          <li>To personalize your experience</li>
          <li>To analyze usage and improve our application</li>
          <li>To communicate with you about your account or service changes</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">6. Data Storage and Security</h3>
        <p className="mb-2">
          Your data is stored securely on servers located within the European Union. 
          We implement appropriate technical and organizational measures to protect your personal data 
          against unauthorized or unlawful processing, accidental loss, destruction, or damage.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">7. Data Retention</h3>
        <p className="mb-2">
          We will retain your personal data only for as long as necessary to fulfill the purposes 
          for which we collected it, including for the purposes of satisfying any legal, accounting, 
          or reporting requirements.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">8. Your Rights</h3>
        <p className="mb-2">Under the GDPR, you have the following rights:</p>
        <ul className="list-disc ml-6 mb-2">
          <li>Right of access to your personal data</li>
          <li>Right to rectification of inaccurate personal data</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to restriction of processing</li>
          <li>Right to data portability</li>
          <li>Right to object to processing</li>
          <li>Right not to be subject to automated decision-making</li>
        </ul>
        <p className="mb-2">
          To exercise any of these rights, please contact us at contact@aivery.com.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">9. Cookies and Analytics</h3>
        <p className="mb-2">
          Our application may use cookies and similar tracking technologies to track activity and store certain information. 
          You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">10. Changes to This Privacy Policy</h3>
        <p className="mb-2">
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page 
          and updating the "Last updated" date.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">11. Contact Us</h3>
        <p className="mb-2">
          If you have any questions about this Privacy Policy or our data practices, please contact us at:
        </p>
        <p className="mb-2">
          Aivery<br />
          Brödermannsweg 77a<br />
          22453 Hamburg<br />
          Germany<br />
          Email: contact@aivery.com
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">12. Supervisory Authority</h3>
        <p className="mb-2">
          If you are a resident of the European Union, you have the right to lodge a complaint with 
          a data protection authority. For more information, please contact your local data protection authority.
        </p>
      </section>

      <p className="text-xs text-gray-500 mt-6">
        Last updated: {new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}
      </p>
    </div>
  );
};

export default PrivacyPolicy; 
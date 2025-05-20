import React from 'react';

const TermsAndConditions: React.FC = () => {
  return (
    <div className="legal-content text-sm">
      <h2 className="text-xl font-bold mb-4">Terms and Conditions</h2>
      
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
        <p className="mb-2">
          These Terms and Conditions govern your use of our fitness tracking application and services 
          provided by Aivery, a company registered in Germany.
        </p>
        <p className="mb-2">
          By using our application, you accept these terms and conditions in full. 
          If you disagree with these terms and conditions or any part of them, you must not use our application.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">2. User Accounts</h3>
        <p className="mb-2">
          When you create an account with us, you must provide information that is accurate, complete, and current at all times.
          Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
        </p>
        <p className="mb-2">
          You are responsible for safeguarding the password you use to access the application and for any activities or actions under your password.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">3. User Content</h3>
        <p className="mb-2">
          Our application allows you to post, link, store, share and otherwise make available certain information, text, graphics, or other material.
          You are responsible for the content you post, including its legality, reliability, and appropriateness.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">4. Intellectual Property</h3>
        <p className="mb-2">
          The application and its original content, features, and functionality are and will remain the exclusive property of 
          Aivery and its licensors. The application is protected by copyright, trademark, and other laws.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">5. Termination</h3>
        <p className="mb-2">
          We may terminate or suspend your account immediately, without prior notice or liability, for any reason, 
          including without limitation if you breach the Terms.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">6. Limitation of Liability</h3>
        <p className="mb-2">
          In no event shall Aivery, nor its directors, employees, partners, agents, suppliers, or affiliates, 
          be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, 
          loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or 
          inability to access or use the application.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">7. Governing Law</h3>
        <p className="mb-2">
          These Terms shall be governed and construed in accordance with the laws of Germany, 
          without regard to its conflict of law provisions.
        </p>
        <p className="mb-2">
          Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">8. Changes to Terms</h3>
        <p className="mb-2">
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
          If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">9. Contact Us</h3>
        <p className="mb-2">
          If you have any questions about these Terms, please contact us at:
        </p>
        <p className="mb-2">
          Aivery<br />
          Brödermannsweg 77a<br />
          22453 Hamburg<br />
          Germany<br />
          Email: contact@aivery.com
        </p>
      </section>

      <p className="text-xs text-gray-500 mt-6">
        Last updated: {new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}
      </p>
    </div>
  );
};

export default TermsAndConditions; 
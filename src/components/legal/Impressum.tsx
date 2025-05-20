import React from 'react';

const Impressum: React.FC = () => {
  return (
    <div className="legal-content text-sm">
      <h2 className="text-xl font-bold mb-4">Impressum</h2>
      
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Information according to § 5 TMG:</h3>
        <p className="mb-2">
          Aivery<br />
          Brödermannsweg 77a<br />
          22453 Hamburg<br />
          Germany
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Contact:</h3>
        <p className="mb-2">
          Email: contact@aivery.com
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Represented by:</h3>
        <p className="mb-2">
          Phillipp Zarindast<br />
          Managing Director
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Registration:</h3>
        <p className="mb-2">
          Commercial Register: Amtsgericht Hamburg<br />
          Registration Number: HRB [Registration Number needs to be added]
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">VAT Identification Number:</h3>
        <p className="mb-2">
          VAT ID according to § 27a UStG: [VAT Number needs to be added]
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Responsible for content according to § 55 Abs. 2 RStV:</h3>
        <p className="mb-2">
          Phillipp Zarindast<br />
          Brödermannsweg 77a<br />
          22453 Hamburg<br />
          Germany
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Dispute Resolution</h3>
        <p className="mb-2">
          The European Commission provides a platform for online dispute resolution (OS): 
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p className="mb-2">
          We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Liability for Content</h3>
        <p className="mb-2">
          As a service provider, we are responsible for our own content on these pages according to § 7 Abs.1 TMG 
          (German Telemedia Act) and general laws. According to §§ 8 to 10 TMG, we are not obliged to monitor 
          transmitted or stored information or to investigate circumstances that indicate illegal activity.
        </p>
        <p className="mb-2">
          Obligations to remove or block the use of information under general law remain unaffected. 
          However, liability in this regard is only possible from the moment of knowledge of a specific violation of law. 
          Upon notification of such violations, we will remove the content immediately.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Liability for Links</h3>
        <p className="mb-2">
          Our offer contains links to external websites of third parties, on whose contents we have no influence. 
          Therefore, we cannot assume any liability for these external contents. 
          The respective provider or operator of the pages is always responsible for the content of the linked pages. 
          The linked pages were checked for possible legal violations at the time of linking. 
          Illegal contents were not recognizable at the time of linking.
        </p>
        <p className="mb-2">
          However, a permanent control of the contents of the linked pages is not reasonable without concrete 
          indications of a violation of law. Upon notification of violations, we will remove such links immediately.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Copyright</h3>
        <p className="mb-2">
          The content and works created by the site operators on these pages are subject to German copyright law. 
          Duplication, processing, distribution, or any form of commercialization of such material beyond the scope 
          of the copyright law shall require the prior written consent of its respective author or creator.
        </p>
        <p className="mb-2">
          Downloads and copies of this site are only permitted for private, non-commercial use.
        </p>
      </section>
    </div>
  );
};

export default Impressum; 
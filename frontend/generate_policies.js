const fs = require('fs');
const path = require('path');

const files = [
  { name: 'PrivacyPolicy', file: '214/content.md', start: 'This Privacy Policy explains' },
  { name: 'RefundPolicy', file: '236/content.md', start: 'Return, Refund & Cancellation Policy' },
  { name: 'ShippingPolicy', file: '241/content.md', start: 'Shipping Policy Pre-Paid Orders' },
  { name: 'TermsCondition', file: '242/content.md', start: 'OVERVIEWThis website is operated by' }
];

const basePath = 'C:/Users/nitin/.gemini/antigravity/brain/bc48a35d-8f59-4be7-ac93-d177799488b0/.system_generated/steps';
const outDir = 'c:/Users/nitin/Desktop/react-FSD-project-ecommerce-main/frontend/src/pages';

files.forEach(item => {
  const mdPath = path.join(basePath, item.file);
  const data = fs.readFileSync(mdPath, 'utf8');
  
  // Find the line that starts with or contains the start string
  const lines = data.split('\n');
  let contentLine = '';
  for (let line of lines) {
    if (line.includes(item.start)) {
      contentLine = line;
      break;
    }
  }
  
  if (!contentLine) {
    console.log('Could not find content for ' + item.name);
    return;
  }
  
  // Clean up and replace
  let text = contentLine.trim();
  text = text.replace(/Overlaysclothing/ig, 'Nilexkart');
  text = text.replace(/OVERLAYS CLOTHING/ig, 'NILEXKART');
  text = text.replace(/Overlays Clothing/ig, 'Nilexkart');
  text = text.replace(/Overlaysnow/ig, 'Nilexkart');
  text = text.replace(/Overlays/ig, 'Nilexkart');
  text = text.replace(/BURNER DIGITAL PRIVATE LIMITED/ig, '[YOUR COMPANY NAME]');
  text = text.replace(/support@overlaysclothing\.com/ig, 'support@nilexkart.com');
  
  // Basic formatting: split sentences loosely into paragraphs for readability
  // Since the entire markdown came as one giant block, we split by ". " followed by capital letter
  const paragraphs = text.split(/(?<=\.)\s+(?=[A-Z])/g).map(p => `<p>${p}</p>`).join('\n          ');

  // Create JSX
  const jsx = `import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import './Policy.css'; // Shared CSS for all policies

const ${item.name} = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="policy-section">
      <Container>
        <h1 className="policy-title">${item.name.replace(/([A-Z])/g, ' $1').trim()}</h1>
        <div className="policy-content">
          ${paragraphs}
        </div>
      </Container>
    </section>
  );
};

export default ${item.name};
`;

  fs.writeFileSync(path.join(outDir, item.name + '.jsx'), jsx);
  console.log('Created ' + item.name + '.jsx');
});

// Also create Policy.css
const css = `
.policy-section {
  padding: 100px 0;
  background-color: #ffffff;
}

.policy-title {
  text-align: center;
  margin-bottom: 40px;
  font-size: 3rem;
}

.policy-content {
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
  color: #333;
  line-height: 1.8;
  font-size: 1.05rem;
}

.policy-content p {
  margin-bottom: 20px;
}
`;
fs.writeFileSync(path.join(outDir, 'Policy.css'), css);
console.log('Created Policy.css');

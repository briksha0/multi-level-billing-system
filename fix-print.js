const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// 1. Update the outer wrapper classes to allow natural flow during print
content = content.replace(
  'className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:bg-white print:inset-auto"',
  'className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto print:static print:block print:p-0 print:bg-white print:overflow-visible"'
);

// 2. Update the inner container classes to remove hardcoded heights that break pagination
content = content.replace(
  'className="bg-white text-slate-900 rounded-2xl p-10 w-full max-w-[210mm] min-h-[200mm] shadow-2xl relative flex flex-col justify-between print:m-10 print:p-10 print:shadow-none print:w-[297mm] print:h-[430mm] print:max-w-none print:rounded-none"',
  'className="bg-white text-slate-900 rounded-2xl p-10 w-full max-w-[210mm] min-h-[200mm] shadow-2xl relative flex flex-col justify-between print:block print:m-0 print:p-8 print:shadow-none print:w-full print:max-w-none print:h-auto print:min-h-0 print:rounded-none"'
);

// 3. Prevent page breaks inside the footer
content = content.replace(
  'className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-5 items-end mt-auto"',
  'className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-5 items-end mt-auto print:mt-10 print:break-inside-avoid"'
);

// 4. Update the global print styles
const oldStyle = /<style>\{[\s\S]*?\}<\/style>/;
const newStyle = <style>{\
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          
          /* Hide everything else on the page */
          body > :not(.fixed) {
            display: none !important;
          }
          
          /* Make the modal wrapper behave like a normal document */
          .fixed {
            position: relative !important;
            display: block !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            inset: auto !important;
          }
          
          /* Ensure table rows don't break across pages */
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      \}</style>;

content = content.replace(oldStyle, newStyle);

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed pagination layout');

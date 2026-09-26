const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

content = content.replace(
  'className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:bg-white print:inset-auto"',
  'className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto print:static print:block print:p-0 print:bg-white print:overflow-visible"'
);

content = content.replace(
  'className="bg-white text-slate-900 rounded-2xl p-10 w-full max-w-[210mm] min-h-[200mm] shadow-2xl relative flex flex-col justify-between print:m-10 print:p-10 print:shadow-none print:w-[297mm] print:h-[430mm] print:max-w-none print:rounded-none"',
  'className="bg-white text-slate-900 rounded-2xl p-10 w-full max-w-[210mm] min-h-[200mm] shadow-2xl relative flex flex-col justify-between print:block print:m-0 print:p-8 print:shadow-none print:w-full print:max-w-none print:h-auto print:min-h-0 print:rounded-none"'
);

content = content.replace(
  'className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-5 items-end mt-auto"',
  'className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-5 items-end mt-auto print:mt-10 print:break-inside-avoid"'
);

const oldStyle = /<style>\{[\s\S]*?\}<\/style>/;
const newStyle = '<style>{\n' +
'        @media print {\n' +
'          @page {\n' +
'            size: A4 portrait;\n' +
'            margin: 10mm;\n' +
'          }\n' +
'          body > :not(.fixed) {\n' +
'            display: none !important;\n' +
'          }\n' +
'          .fixed {\n' +
'            position: relative !important;\n' +
'            display: block !important;\n' +
'            overflow: visible !important;\n' +
'            background: white !important;\n' +
'            padding: 0 !important;\n' +
'            inset: auto !important;\n' +
'          }\n' +
'          tr {\n' +
'            page-break-inside: avoid;\n' +
'            break-inside: avoid;\n' +
'          }\n' +
'        }\n' +
'      }</style>';

content = content.replace(oldStyle, newStyle);

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed pagination layout successfully');

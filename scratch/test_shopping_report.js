const { sendDailyShoppingReport } = require('../app/api/whatsapp/shopping-report/route');

async function test() {
  console.log('Testing sendDailyShoppingReport...');
  try {
    const res = await sendDailyShoppingReport();
    console.log('Report result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error testing report:', err);
  }
}

test();

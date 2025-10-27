export const QboSelectors = {
  login: {
    email: 'input[name="Email"]',
    password: 'input[name="Password"]',
    submit: 'button[type="submit"]',
    smsOptionButton: 'button[data-testid="challengePickerOption_SMS_OTP"]',
    otpInput: '#ius-mfa-confirm-code',
  },
  nav: {
    clientHomepage: 'div[data-testid="graphicWithDynamicTextRowsLayout"] button[aria-label="qbBall"]',
  },
  bankFeed: {
    forReviewTab: 'button[id=idsTab-REVIEW]',
    transactionRows: 'div[id="idsTab-REVIEW-tabPanel"] table tbody tr',
    date: 'td.txnDate',
    description: 'td.description',
    payee: 'td.payee',
    category: 'td.category',
    spent: 'td.spent',
    received: 'td.received',
    actionButton: 'td.action button[id="txn-0"]',
  },
};



const puppeteer = require('puppeteer');
const faker = require('faker');
const axios = require('axios');

const format = (str) => str.replace(/[^a-zA-Z ]/g, '').toLowerCase();

function userGenerator() {
  const firstname = faker.name.firstName();
  const lastname = faker.name.lastName();
  const emailId = `${format(firstname)}.${format(lastname)}@yourstories.space`;
  const password = faker.internet.password();
  return {
    firstname,
    lastname,
    password,
    emailId,
  };
}

async function waitForEmailVerificationLink(emailId, maxWaitMs = 120 * 1000) {
  return new Promise((resolve, reject) => {
    async function fn() {
      const requestUrl = `http://localhost:3000/api/otp`;
      const params = {
        email: emailId,
        search_query: 'from:noreply@airtable.com subject:(Please confirm your email)',
        configurations: [
          {
            fields: [
              {
                selector:
                  'table > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1) > a:nth-child(4)',
                fieldName: 'verify',
                fieldKey: 'verify',
              },
            ],
          },
        ],
      };

      const timer = setInterval(async () => {
        const response = await axios.post(requestUrl, params);
        const { data } = response;
        switch(data.status) {
          case 0: {
            console.log('email not recevied yet');
            break;
          }
          case 1: {
            console.log('email was received but could not extract the data');
            reject(new Error('email was received but could not extract the data'));
            break;
          }
          case 2: {
            console.log('email has been received');
            const { results } = data;
            const { verify_link: verifyLink } = results[0];
            resolve(verifyLink);
            clearInterval(timer);
            break;
          }
          default:
            break;
        }
      }, 8 * 1000);
    }

    fn();
  })
}

async function doSignup() {
  const browser = await puppeteer.launch(
    {headless: false}
  );
  const page = await browser.newPage();
  await page.goto('https://airtable.com/invite/r/hW39TmDm');

  const { firstname, lastname, password, emailId} = userGenerator();

  await page.type('#sign-up-form-fields-root [name="firstName"]', firstname);
  await page.type('#sign-up-form-fields-root [name="lastName"]', lastname);
  await page.type('#sign-up-form-fields-root [name="email"]', emailId);
  await page.type('#sign-up-form-fields-root [name="password"]', password);

  await page.$eval('#signUpForm', form => form.submit());


  // there's gonna be a verification email from airtable
  // we have a configuration of that email
  // is an API that can give the link in the verification email


  try {
    const verifyLink = await waitForEmailVerificationLink(emailId);
    console.log({verifyLink});
    await page.goto(verifyLink);
  } catch(e) {
    console.log(e);
  }

  // await page.waitFor(60 *1000);

  await browser.close();
}

(async () => {
  // bootstrap
  [...new Array(1)]
  .reduce(async (previousPromise) => {
    await previousPromise;
    await doSignup();
  }, Promise.resolve())
})();
import {
  Meteor
} from 'meteor/meteor';
import {
  HTTP
} from 'meteor/http';
import '../lib/router.js'
import {
  Accounts
} from 'meteor/accounts-base';


import Stripe from 'stripe';
const stripe = Stripe(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);
const stripePub = Stripe(Meteor.settings['galaxy.meteor.com'].env.STRIPE_PUBLIC_KEY);
const stripePrice = Stripe(Meteor.settings['galaxy.meteor.com'].env.PRICE_ID);

process.env.MAIL_URL = Meteor.settings['galaxy.meteor.com'].env.MAIL_URL;



import bodyParser from 'body-parser';
import {
  check
} from 'meteor/check';



if (Meteor.isServer) {
  Meteor.startup(() => {
    console.log('MONGO_URL:', Meteor.settings['galaxy.meteor.com'].env.MONGO_URL);
    console.log('STRIPE_PRICE:', Meteor.settings['galaxy.meteor.com'].env.PRICE_ID);



  });
}


Accounts.emailTemplates.from = 'support@prose.ninja';
Accounts.emailTemplates.resetPassword.subject = function() {
  return 'Reset your password';
};

Accounts.emailTemplates.resetPassword.html = function(user, url) {
  return `
    <div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 4px;">
        <h1 style="color: #333; font-size: 24px;">Hello, this is Prose Ninja</h1>
        <p style="color: #666; font-size: 16px;">Click the link below to reset your password:</p>
        <a href="${url}" style="display: inline-block; padding: 10px 20px; color: #ffffff; background-color: #3498db; border-radius: 4px; text-decoration: none;">Reset Password</a>
      </div>
    </div>
  `;
};

Accounts.emailTemplates.verifyEmail.subject = function() {
  return 'Verify your email address';
};

Accounts.emailTemplates.verifyEmail.html = function(user, url) {
  return `
    <div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 4px;">
        <h1 style="color: #333; font-size: 24px;">Hello, this is Prose Ninja</h1>
        <p style="color: #666; font-size: 16px;">Click the link below to verify your email address:</p>
        <a href="${url}" style="display: inline-block; padding: 10px 20px; color: #ffffff; background-color: #3498db; border-radius: 4px; text-decoration: none;">Verify Email</a>
      </div>
    </div>
  `;
};


/////

WebApp.connectHandlers.use(bodyParser.urlencoded({
  extended: false
}));
WebApp.connectHandlers.use(bodyParser.json());
WebApp.connectHandlers.use('/stripe-webhook', Meteor.bindEnvironment((req, res) => {

  console.log("Webhook hit");
  console.log(req.body);

  let event;
  let isPaying;
  let updateData; // Declare updateData once here

  try {
    event = req.body;
  } catch (err) {
    res.statusCode = 400;
    res.end(`Webhook Error: ${err.message}`);
    return;
  }

  const data = event.data.object;

  switch (event.type) {
    case 'invoice.payment_succeeded':
      let customerPaid = data.customer;
      isPaying = data.status === 'paid';

      console.log("Preparing to update 'isPaying' for customer", customerPaid, "to", isPaying);

      updateData = {
        "profile.isPaying": isPaying,
        "profile.clientHasCancelled": false,
        "profile.subscriptionEndsAt": null
      };

      Meteor.users.update({
        "stripeCustomerId": customerPaid
      }, {
        $set: updateData
      }, (error, numUpdated) => {
        if (error) {
          console.log("Failed to update 'isPaying':", error);
        } else if (numUpdated === 0) {
          console.log("No user found with stripeCustomerId:", customerPaid);
        } else {
          console.log("Successfully updated 'isPaying'");
        }
      });
      break;
    case 'customer.subscription.deleted':
      let customerDel = data.customer;

      console.log("Deleting subscription for customer", customerDel);

      Meteor.users.update({
        "stripeCustomerId": customerDel
      }, {
        $set: {
          "profile.isPaying": false,
          "profile.clientHasCancelled": true // set to true when client unsubscribes
        }
      }, (error) => {
        if (error) {
          console.log("Failed to delete subscription:", error);
        }
      });
      break;
    case 'customer.subscription.updated':
      let customerUpdated = data.customer;
      let subscriptionEndsAt = new Date(data.current_period_end * 1000); // Stripe timestamps are in seconds
      isPaying = data.status !== 'canceled'; // set isPaying to true if subscription is active, false if it's canceled
      let clientHasCancelled = data.cancel_at_period_end; // True if the client has cancelled the subscription

      let updateData = {
        "profile.isPaying": isPaying,
        "profile.subscriptionEndsAt": clientHasCancelled ? subscriptionEndsAt : null, // Clear if resubscribed
        "profile.clientHasCancelled": clientHasCancelled, // Set based on the cancel_at_period_end field
        "profile.cancelAtPeriodEnd": clientHasCancelled  // Ensure this is updated correctly
      };


      console.log("Updating subscription for customer", customerUpdated, "to", updateData);

      Meteor.users.update({
        "stripeCustomerId": customerUpdated
      }, {
        $set: updateData
      }, (error, numUpdated) => {
        if (error) {
          console.log("Failed to update subscription:", error);
        } else if (numUpdated === 0) {
          console.log("No user found with stripeCustomerId:", customerUpdated);
        } else {
          console.log("Successfully updated subscription");
        }
      });
      break;



  }

  // Return a response to Stripe to acknowledge receipt of the event
  res.writeHead(200);
  res.end();
}));

/////////////////////////////////////

Accounts.onCreateUser(function(options, user) {
  // Use the default hook's implementation.
  if (options.profile)
    user.profile = options.profile;

  // If the new user has an email, send a verification email.
  if (user.emails && user.emails[0].address) {
    Meteor.setTimeout(function() {
      Accounts.sendVerificationEmail(user._id);
    }, 2 * 1000); // The delay is optional, in this case 2 seconds.

    console.log("verification mail sent")

  }

  return user;
});


////////////////////////////////////

Meteor.methods({
/*
  'createSubscription': async function(email, paymentMethodId) {
    try {
      const stripe = require('stripe')(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);
      const planId = Meteor.settings['galaxy.meteor.com'].env.PRICE_ID;
      console.log(planId);

      // Create customer
      const customer = await stripe.customers.create({
        email,
      });

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ plan: planId }],
        expand: ['latest_invoice.payment_intent'],
      });

      return subscription.latest_invoice.payment_intent.client_secret;

    } catch (error) {
      console.log('Stripe Error:', error);
      throw new Meteor.Error('stripe-error', error.message);
    }
  },


 'startSubscription': async function(paymentMethodId) {
   const stripe = require('stripe')(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);
   const userId = this.userId;
   const user = Meteor.users.findOne(userId);
   const customerId = user.stripeCustomerId;
   const priceId = Meteor.settings['galaxy.meteor.com'].env.PRICE_ID;

   // Attach the payment method to the customer
   await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

   // Set it as the default payment method
   await stripe.customers.update(customerId, {
     invoice_settings: {
       default_payment_method: paymentMethodId,
     },
   });

   // Create the subscription
   const subscription = await stripe.subscriptions.create({
     customer: customerId,
     items: [{ price: priceId }],
     expand: ['latest_invoice.payment_intent'],
   });

   // Save the subscription ID in the user document
   Meteor.users.update(userId, {
     $set: {
       stripeSubscriptionId: subscription.id
     }
   });

   // Return the entire subscription object, including the status and latest_invoice details
   return subscription;
 },
*/


  'resendVerificationEmail': function() {
    const userId = this.userId;
    if (!userId) {
      throw new Meteor.Error('not-logged-in', 'User must be logged in to request a verification email.');
    }

    const user = Meteor.users.findOne(userId);
    if (user && user.emails && user.emails.length > 0 && !user.emails[0].verified) {
      Accounts.sendVerificationEmail(userId);
    }
  },

/*
  'cancelSubscription': function(userId) {
    check(userId, String);

    const user = Meteor.users.findOne(userId);
    const subscriptionId = user.stripeSubscriptionId; // fetch subscriptionId from user document

    stripe.subscriptions.update(
      subscriptionId, {
        cancel_at_period_end: true
      }
    ).then(() => {
      // handle successful cancellation
      // You may want to update user's subscription status here, for example:
      // Meteor.users.update(this.userId, { $set: { 'subscriptionStatus': 'cancelling' } });
    }).catch((err) => {
      // handle error
      console.log(err);
    });
  },
*/
  createUserAccount(email, password) {
    const userId = Accounts.createUser({
      email,
      password
    });

    if (userId) {
      // Your logic after a user is created
      const stripeCustomerId = Meteor.call('stripe.createCustomer', email);
      Meteor.users.update(userId, {
        $set: {
          "stripeCustomerId": stripeCustomerId,
          "profile.isPaying": false
        }
      });
    }
  },



  incrementUserCounter(userId) {
    check(userId, String);

    const user = Meteor.users.findOne(userId);

    if (!user) {
      throw new Meteor.Error('User not found');
    }

    const now = new Date();

    // Add the current timestamp to the 'submissionTime' array
    Meteor.users.update(userId, {
      $inc: {
        'profile.counter': 1,
      },
      $push: {
        'profile.submissionTime': now,
      },
    });
  },
  countRequestsLastHour(userId) {
    check(userId, String);

    const hourAgo = new Date(new Date().getTime() - 1000 * 60 * 60);
    const user = Meteor.users.findOne({
      _id: userId,
    });

    // Check the 'submissionTime' array and count the submissions from the last hour
    if (user && user.profile && user.profile.submissionTime) {
      const count = user.profile.submissionTime.reduce(
        (count, timestamp) => (timestamp >= hourAgo ? count + 1 : count),
        0
      );

      return count;
    }

    // If the user doesn't have a 'submissionTime' array, return 0
    return 0;
  },
  'stripe.createCustomer': function(email) {
    const stripe = require('stripe')(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);

    const customer = Meteor.wrapAsync(stripe.customers.create, stripe.customers)({
      email: email,
      // add other customer information as needed
    });

    return customer.id;
  },


  'getApiKey': function() {
    return Meteor.settings['galaxy.meteor.com'].env.OPENAI_API_KEY;
    },

  'getPolishedText': function(text, formality, language) {
      if (!text || !formality || !language) {
        throw new Meteor.Error('Invalid parameters');
      }

      const url = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
      const headers = {
        'Authorization': `Bearer ${Meteor.settings['galaxy.meteor.com'].env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      };
      const prompt = `Polish and make this text longer: "${text}" and write it in  "${language}" with a very "${formality}" tone.
    Write nice longer sentences. If the text seems to be a message to someone, add the necessary greetings and line breaks. Make it look natural, as written by a human.`;
      const data = {
        'prompt': prompt,
        'max_tokens': 500
      };

      try {
        const response = HTTP.call('POST', url, {
          headers: headers,
          data: data
        });
        return response.data.choices[0].text;
      } catch (error) {
        console.error(error.response);
        throw new Meteor.Error('OpenAI API error', error.response);
      }

    }


    ,

  'getReplyToMessage': function(text, formality, language, answer) {
    if (!text || !formality || !language) {
      throw new Meteor.Error('Invalid parameters');
    }

    const url = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
    const headers = {
      'Authorization': `Bearer ${Meteor.settings['galaxy.meteor.com'].env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    };
    const prompt = `Someone wrote me this e-mail: "${text}", answer to it in  "${language}" with a very "${formality}" tone.
    Write nice longer sentences and add the polite expressions and line breaks. Make it look natural, as written by a human.
    Add the necessary greetings. The message should convey the following idea: "${answer}"`;
    const data = {
      'prompt': prompt,
      'max_tokens': 500
    };

    try {
      const response = HTTP.call('POST', url, {
        headers: headers,
        data: data
      });
      return response.data.choices[0].text;
    } catch (error) {
      console.error(error.response);
      throw new Meteor.Error('OpenAI API error', error.response);
    }

  },
/*
  startSubscription: function(userId, paymentMethodId) {
     const stripe = require('stripe')(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);
     const user = Meteor.users.findOne(userId);
     const customerId = user.stripeCustomerId;
     const subscriptionPriceId = Meteor.settings['galaxy.meteor.com'].env.PRICE_ID;

     // Attach the payment method to the customer
     stripe.paymentMethods.attach(paymentMethodId, {
       customer: customerId,
     });

     // Set it as the default payment method
     stripe.customers.update(customerId, {
       invoice_settings: {
         default_payment_method: paymentMethodId,
       },
     });

     // Create the subscription
     const subscription = stripe.subscriptions.create({
       customer: customerId,
       items: [{ price: subscriptionPriceId }],
       expand: ['latest_invoice.payment_intent'],
     });

     // Save the subscription ID in the user document
     Meteor.users.update(userId, {
       $set: {
         stripeSubscriptionId: subscription.id
       }
     });

     return subscription;
   },

  'attachPaymentMethod': function(customerId, paymentMethodId) {
    const stripe = require('stripe')(Meteor.settings['galaxy.meteor.com'].env.STRIPE_SECRET_KEY);

    try {
      const paymentMethod = Meteor.wrapAsync(stripe.paymentMethods.attach, stripe.paymentMethods)(paymentMethodId, {
        customer: customerId,
      });
      // Set the attached PaymentMethod as the default for the customer
      Meteor.wrapAsync(stripe.customers.update, stripe.customers)(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });
      return true;
    } catch (error) {
      throw new Meteor.Error('stripe-error', error.message);
    }
  },

*/
'createSubscription': async function(paymentMethodId, priceId) {



   const userId = this.userId;
   const user = Meteor.users.findOne(userId);

   // Attach the payment method to the customer
   await stripe.paymentMethods.attach(paymentMethodId, {
     customer: user.stripeCustomerId,
   });

   // Set it as the default payment method for the customer
   await stripe.customers.update(user.stripeCustomerId, {
     invoice_settings: {
       default_payment_method: paymentMethodId,
     },
   });

   const subscription = await stripe.subscriptions.create({
     customer: user.stripeCustomerId,
     items: [{ price: priceId }],
     expand: ['latest_invoice.payment_intent'],
   });

   // Register the subscription ID in the database
Meteor.users.update(userId, {
  $set: {
    'profile.subscriptionId': subscription.id,
    'profile.hasSubscribed': true
  }
});


   const paymentIntent = subscription.latest_invoice.payment_intent;

   if (paymentIntent.status === 'requires_action') {
     return paymentIntent.client_secret; // Return client_secret to client to handle 3D Secure
   } else {
     return null;
   }
 },
 'updateUserToPaying': function() {
   const userId = this.userId;
   Meteor.users.update(userId, {
     $set: {
       'profile.isPaying': true,
     }
   });
 },

 'cancelSubscription': async function() {
    const userId = this.userId;
    const user = Meteor.users.findOne(userId);
    const subscriptionId = user.profile.subscriptionId;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Convert UNIX timestamp to a JavaScript Date object and then to a readable string
      const endDate = new Date(subscription.current_period_end * 1000).toLocaleString();

      // Update the user document to reflect subscription state and next billing date
      Meteor.users.update(userId, {
        $set: {
          'profile.subscriptionStatus': subscription.status,
          'profile.cancelAtPeriodEnd': subscription.cancel_at_period_end,
          'profile.currentPeriodEnd': subscription.current_period_end
        }
      });

      console.log(`Subscription will end on: ${endDate}`);

      return true;
    } else {
      throw new Meteor.Error('No subscription found for this user.');
    }
  }
});
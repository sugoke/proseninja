import {
  Template
} from 'meteor/templating';
import {
  ReactiveVar
} from 'meteor/reactive-var';
import '../lib/router.js'
//import { Template } from 'meteor/blaze';
import Swal from 'sweetalert2'
import moment from 'moment';
import './main.html';
import { Accounts } from 'meteor/accounts-base';

const stripePub = Meteor.settings.public.STRIPE_PUBLIC_KEY;

import { TAPi18n } from 'meteor/tap:i18n';


//let stripe; // Declare at the top-level scope to make it accessible in other functions
let cardElement; // Declare at the top-level scope to make it accessible in other functions

Meteor.startup(() => {
  // Initialize i18n
  TAPi18n.setLanguage('en'); // Set the default language


  // Optionally, you can load translations here
  // TAPi18n.loadTranslations({ ... });
});

// When the user navigates to the verification link provided in the email
Accounts.onEmailVerificationLink((token, done) => {
  Accounts.verifyEmail(token, (error) => {
    if (error) {
      // If there's an error, show it using SweetAlert
      Swal.fire('Error', 'Verification failed. Please try again.', 'error');
    } else {
      // If the verification is successful, show a success message
      Swal.fire('Success', 'Your email has been verified!', 'success');
      done();  // Important: Call the done function to continue with the default behavior if needed.
    }
  });


Accounts.onResetPasswordLink((token, done) => {
  Swal.fire({
    title: 'Reset Your Password',
    input: 'password',
    inputPlaceholder: 'Enter your new password',
    inputAttributes: {
      minlength: '7',
      autocapitalize: 'off',
      autocorrect: 'off'
    },
    showCancelButton: true,
    confirmButtonText: 'Reset Password',
    showLoaderOnConfirm: true,
    preConfirm: (newPassword) => {
      return new Promise((resolve, reject) => {
        Accounts.resetPassword(token, newPassword, (error) => {
          if (error) {
            reject(error.reason || 'Unable to reset password');
          } else {
            resolve();
          }
        });
      });
    },
    allowOutsideClick: () => !Swal.isLoading()
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire('Success', 'Your password has been reset!', 'success');
      done();
    }
  }).catch(Swal.hideLoading); // Hide loading state on user cancel or any error
});

});

Meteor.startup(() => {



});

function processRequest() {
  document.getElementById('overlay').style.display = 'block';

  $("#polishedText").slideDown("slow");
  $("#copyBtn1").slideDown("slow");
  $("#emailBtn1").slideDown("slow");

  const text = document.getElementById('rawText').value;
  const formality = document.getElementById('formalitySelect').value;
  const language = document.getElementById('languageSelect').value;

  Meteor.call('getPolishedText', text, formality, language, function(error, result) {
    if (error) {
      console.error("Server error", error);
    } else {
      document.getElementById('polishedText').value = result;
      document.getElementById('overlay').style.display = 'none';
    }
  });

  // Increment user's submission counter
  Meteor.call('incrementUserCounter', Meteor.userId());
}


Template.formTemplate.helpers({
  formalityOptions: ['Informal', 'Neutral', 'Formal'],
  languageOptions: ['English', 'Spanish', 'French', 'German', 'Italian']
});

Template.formTemplate.helpers({

  hasVerifiedEmail: function() {
     const user = Meteor.user();
     if (!user) {
       return false;
     }

     const email = user && user.emails && user.emails[0];
     return email && email.verified;
   },

  clientHasCancelled() {
    const user = Meteor.user();
    return user && user.profile && user.profile.clientHasCancelled;
  },

  hasUserSubscribed() {
    const user = Meteor.user();
    return user && user.profile && user.profile.isPaying; // adjust this based on your actual data structure
  }
});

Template.navBar.helpers({

  emailVerified: function() {
    const user = Meteor.user();
    if (user && user.emails && user.emails.length > 0) {
      return user.emails[0].verified;
    }
    return false;
  },



  'currentUser': function() {
    return Meteor.user();
  },

  'email': function() {
     return Meteor.user() && Meteor.user().emails && Meteor.user().emails[0] && Meteor.user().emails[0].address;
   },

   isPaying() {
       const user = Meteor.user();
       return user && user.profile.isPaying;
     },
     cancelAtPeriodEnd() {
       const user = Meteor.user();
       return user && user.profile.cancelAtPeriodEnd;
     },
     shouldShowNextBillingDate() {
       const user = Meteor.user();
       return user && user.profile.subscriptionEndsAt && (user.profile.isPaying || user.profile.cancelAtPeriodEnd);
     },
     cancellationInProgress() {
       const user = Meteor.user();
       return user && user.profile && 'cancellationInProgress' in user.profile && user.profile.cancellationInProgress;
     },
     subscriptionEndsAt() {
       const user = Meteor.user();
       if (user && user.profile.currentPeriodEnd) {
         return moment.unix(user.profile.currentPeriodEnd).format("MMMM Do, YYYY");
       }
       return "N/A";
     },
     serviceEndsAt() {
       const user = Meteor.user();
       if (user && user.profile.serviceEndsAt) {
         return moment.unix(user.profile.serviceEndsAt).format("MMMM Do, YYYY");
       }
       return "N/A";
     },
 // ...other existing helpers...

 currentUserProfile() {
     const user = Meteor.user();
     if (user && user.profile) {
       console.log("Current period end:", user.profile.currentPeriodEnd);
     }
     return user ? user.profile : null;
   },
   currentPeriodEndFormatted() {
     if (this.currentPeriodEnd) {
       console.log("Formatted date:", moment.unix(this.currentPeriodEnd).format('MMMM Do, YYYY'));
       return moment.unix(this.currentPeriodEnd).format('MMMM Do, YYYY');
     } else {
       console.log("currentPeriodEnd is not available or not a valid timestamp");
       return null;
     }
   },
 // ...other existing helpers...
});

Template.navBar.events({

  'click .btn[data-target="#checkoutModal"]': function(event, template) {
  $('#profileModal').modal('hide'); // Close the profileModal
  $('#checkoutModal').modal('show'); // Open the checkoutModal
},

  'click #resendVerificationLink': function(event) {
     event.preventDefault();

     Meteor.call('resendVerificationEmail', (error, response) => {
       if (error) {
         console.error("Error resending verification email:", error);
         Swal.fire({
           icon: 'error',
           title: 'Oops...',
           text: 'There was a problem sending the verification email. Please try again later.'
         });
       } else {
         Swal.fire({
           icon: 'success',
           title: 'Verification Email Sent',
           text: 'Please check your inbox and follow the link in the email to verify your address.'
         });
       }
     });
   },

   'click #confirmUnsubscribeButton': function() {

     console.log("user clicked yes twice")

   },


  'click #unsubscribeLink': function(event, template) {
    event.preventDefault();

    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to cancel your subscription?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        // Trigger the click event for #confirmUnsubscribeButton

        const user = Meteor.user();
        const subscriptionId = user.profile.subscriptionId;

        Meteor.call('cancelSubscription', subscriptionId, (error, result) => {
          if (error) {
            console.log("An error occurred while canceling the subscription:", error);

            Swal.fire({
              title: 'Error!',
              text: 'An error occurred while canceling the subscription.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
            return;
          }

          if (result) {
            console.log("Subscription successfully canceled.");

            Swal.fire({
              title: 'Success!',
              text: 'Subscription successfully canceled.',
              icon: 'success',
              confirmButtonText: 'OK'
            }).then(() => {
              // Close the dialog box
              $('#yourModalId').modal('hide'); // Replace 'yourModalId' with the actual ID of your modal
            });

            // Perform any additional actions like routing the user or showing a confirmation message
          }
        });



      }
    });
  }



});




Template.formTemplate.events({

  'click #emailBtn1'(event, instance) {
    event.preventDefault();
    let polishedText = instance.find("#polishedText").value;
    let mailtoLink = document.createElement('a');
    mailtoLink.href = "mailto:?body=" + encodeURIComponent(polishedText);
    mailtoLink.style.display = 'none';
    document.body.appendChild(mailtoLink);
    mailtoLink.click();
    document.body.removeChild(mailtoLink);
  },

  'click #copyBtn1': function(event, instance) {

    event.preventDefault();

    const polishedText = document.getElementById('polishedText').value;

    navigator.clipboard.writeText(polishedText)
      .then(() => {
        console.log('Text copied to clipboard');
      })
      .catch(err => {
        console.error('Error in copying text: ', err);
      });
  },

  'click #copyBtn2': function(event, instance) {

    event.preventDefault();

    const replyToMessage = document.getElementById('replyToMessage').value;

    navigator.clipboard.writeText(replyToMessage)
      .then(() => {
        console.log('Text copied to clipboard');
      })
      .catch(err => {
        console.error('Error in copying text: ', err);
      });
  },

  'click #clearBtn1': function(event, template) {
    event.preventDefault();
    template.find("#rawText").value = '';
  },

  'click #pasteBtn1': function(event, instance) {
    event.preventDefault();

    if (!navigator.clipboard) {
      Swal.fire({
  icon: 'error',
  title: 'Oops...',
  text: 'Clipboard API not available',
});

      return;
    }

    navigator.clipboard.readText()
      .then(text => {
        document.getElementById('rawText').value = text;
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
  },

  'click #submit': function(event, instance) {
    event.preventDefault();

    // Check user request limit
    Meteor.call('countRequestsLastHour', Meteor.userId(), (error, count) => {
      if (error) {
        console.error("Server error", error);
      } else {
        // Fetch the current user document
        const user = Meteor.user();

        // Check if user is a paying user and exceeded hourly limit
        if (user && user.profile && user.profile.isPaying && count > 9) {
          // Show the limit modal
          $('#hourlyLimit').modal('show');
          return;
        }

        // Check if user is a non-paying user and exceeded daily limit
        else if (user && user.profile && !user.profile.isPaying && user.profile.counter > 0) {
          // Show the subscription modal
          $('#subscribeModal').modal('show');
          return;
        } else {
          document.getElementById('overlay').style.display = 'block';
        }

        $("#polishedText").slideDown("slow");
        $("#copyBtn1").slideDown("slow");
        $("#emailBtn1").slideDown("slow");

        const text = document.getElementById('rawText').value;
        const formality = document.getElementById('formalitySelect').value;
        const language = document.getElementById('languageSelect').value;

        Meteor.call('incrementUserCounter', Meteor.userId(), (error, result) => {
          if (error) {
            console.error("Server error", error);
          }
        });

        Meteor.call('getPolishedText', text, formality, language, function(error, result) {
          if (error) {
            console.error("Server error", error);
          } else {
            document.getElementById('polishedText').value = result;
            document.getElementById('overlay').style.display = 'none';
          }
        });

      }
    });
  },





  //second tab1


  'click #pasteBtn2': function(event, instance) {
    event.preventDefault();

    if (!navigator.clipboard) {
      Swal.fire({
  icon: 'error',
  title: 'Oops...',
  text: 'Clipboard API not available',
});

      return;
    }

    navigator.clipboard.readText()
      .then(text => {
        document.getElementById('messageToReplyTo').value = text;
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
  },

  'click #clearBtn2': function(event, template) {
    event.preventDefault();
    template.find("#messageToReplyTo").value = '';
  },

  ///////////////////////////////////////////////////////////

  'click #clearBtn3': function(event, template) {
    event.preventDefault();
    template.find("#answer").value = '';
  },



  'click #pasteBtn2': function(event, instance) {
    event.preventDefault();

    if (!navigator.clipboard) {


      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Clipboard API not available',
      });


      return;
    }

    navigator.clipboard.readText()
      .then(text => {
        document.getElementById('messageToReplyTo').value = text;
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
  },

  'click #clearBtn3': function(event, template) {
    event.preventDefault();
    template.find("#answer").value = '';
  },



  'click #submit2': function(event, instance) {
    event.preventDefault();

    document.getElementById('overlay').style.display = 'block';


    $("#replyToMessage").slideDown("slow");
    $("#copyBtn2").slideDown("slow");


    const text = document.getElementById('messageToReplyTo').value;
    const formality = document.getElementById('tonality2').value;
    const language = document.getElementById('language2').value;
    const answer = document.getElementById('answer').value;

    Meteor.call('getReplyToMessage', text, formality, language, answer, function(error, result) {
      if (error) {
        console.error("Server error", error);
      } else {
        document.getElementById('replyToMessage').value = result;
        document.getElementById('overlay').style.display = 'none';
      }
    });
  }



});


Meteor.call('getApiKey', function(error, result) {
  if (error) {
    console.error('Error retrieving API key:', error);
  } else {
    console.log('API key:', result);
  }
});

Template.formTemplate.helpers({
  showRegisterForm() {
    return Session.get('showRegisterForm');
  },
  showForgotPasswordForm() {
    return Session.get('showForgotPasswordForm');
  },
});




Template.myLoginForm.events({

  'click #forgot-password-link'(event) {
    event.preventDefault();


    Session.set('showForgotPasswordForm', true);
    Session.set('showRegisterForm', false);
  },

  'submit #login-form'(event) {
    event.preventDefault();

    const email = event.target.email.value;
    const password = event.target.password.value;

    Meteor.loginWithPassword(email, password, function(err) {
      if (err) {
        // Show the error modal
        $('#errorModalText').text("Unknown user or wrong password."); // Update the modal text with the specific error message
        $('#errorModal').modal('show');
      } else {
        // handle successful login
      }
    });
  },


  'click #register-link'(event) {
    event.preventDefault();
    Session.set('showRegisterForm', true);
    Session.set('showForgotPasswordForm', false);
  },

  'click #login-link'(event) {
    event.preventDefault();
    Session.set('showForgotPasswordForm', false);
    Session.set('showRegisterForm', false);
  },

  'submit #forgot-password-form'(event) {
    event.preventDefault();

    const email = event.target.email.value;

    Accounts.forgotPassword({ email }, function(err) {
      if (err) {

        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.message,
        });



      } else {


        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Password reset email sent. Please check your inbox.',
        });

        Session.set('showForgotPasswordForm', false);
      }
    });
  },

  // You can add more event handlers here for other elements

});


Template.myRegisterForm.events({
  'submit #register-form'(event) {
    event.preventDefault();

    const email = event.target.email.value;
    const password = event.target.password.value;

    Meteor.call('createUserAccount', email, password, function(err) {
      if (err) {
        // handle error
        Swal.fire({
  icon: 'error',
  title: 'Oops...',
  text: err.message,
});
      } else {
        // handle successful registration
        Session.set('showRegisterForm', false);

        Meteor.loginWithPassword(email, password, function(err) {
          if (err) {
            // handle error
          } else {
            // handle successful login
          }
        });
      }
    });



  },

  'click #login-link'(event) {
    event.preventDefault();

    // hide registration form and show login form
    Session.set('showRegisterForm', false);
  },
});

Template.myLoginForm.helpers({
  showLoginForm: function() {
    return !Session.get('showRegisterForm') && !Session.get('showForgotPasswordForm');
  },
  showRegisterForm: function() {
    return Session.get('showRegisterForm');
  },
  showForgotPasswordForm: function() {
    return Session.get('showForgotPasswordForm');
  },
});



Template.formTemplate.helpers({
  showRegisterForm() {
    return Session.get('showRegisterForm');
  },
});

Template.myForgotPasswordForm.events({
  'submit #forgot-password-form'(event) {
    event.preventDefault();

    const email = event.target.email.value;

    Accounts.forgotPassword({ email }, function(err) {
      if (err) {
        // handle error, e.g., show an alert with the error message
        Swal.fire({
  icon: 'error',
  title: 'Oops...',
  text: err.message,
});
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Check your email for instructions to reset your password.',
        });
      }
    });
  },

  'click #login-link'(event) {
    event.preventDefault();

    // hide forgot password form and show login form
    Session.set('showForgotPasswordForm', false);
    Session.set('showRegisterForm', false);
  }
});




Template.navBar.events({
  'click #logout-button'() {
      Swal.fire({
        title: 'Are you sure?',
        text: 'You will be logged out.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, log out',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          Meteor.logout(function(err) {
            if (err) {
              console.log("Error logging out: ", err);
              Swal.fire('Oops...', 'Something went wrong!', 'error');
            } else {
              // Close the profile modal
              $('#profileModal').modal('hide');
              // Redirect or perform some other action
              console.log("Successfully logged out");
              Swal.fire('Logged Out', 'You have been logged out.', 'success');
            }
          });
        }
      });
    },


  'click #unsubscribe-button'(event) {
    // implement your logic for unsubscribing a user
  },
});


//////////////////


Template.checkoutForm.onRendered(function() {
  stripe = Stripe(Meteor.settings.public.STRIPE_PUBLIC_KEY);
  const elements = stripe.elements();
  cardElement = elements.create('card');
  cardElement.mount('#payment-element');


  const currencyPriceDiv = document.getElementById('currency-price');

    // Initialize with EUR as the default
    currencyPriceDiv.textContent = "8.90 EUR per month";

    // Add event listeners to currency buttons
    const currencyButtons = document.querySelectorAll('.currency-button');
    currencyButtons.forEach((btn) => {
      btn.addEventListener('click', function(e) {
        currencyButtons.forEach((btn) => btn.classList.remove('active'));
        btn.classList.add('active');

        const selectedCurrency = btn.querySelector('input').value;
        if (selectedCurrency === 'EUR') {
          currencyPriceDiv.textContent = "8.90 EUR per month";
        } else if (selectedCurrency === 'USD') {
          currencyPriceDiv.textContent = "9.90 USD per month";
        }
      });
    });



});

Template.checkoutForm.helpers({
  userEmail() {
    const user = Meteor.user();
    return user && user.emails && user.emails[0].address;
  },
});

Template.checkoutForm.events({
  'submit #payment-form': async function(event, template) {
  event.preventDefault();

  // Check if card holder name is entered
const cardHolderName = document.getElementById('card-holder-name').value;
if (!cardHolderName) {
  console.log("Card holder name is required.");
  return;
}

  // Show spinner and disable button
  document.getElementById('submit-button').innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submit Payment';
  document.getElementById('submit-button').disabled = true;

  const selectedCurrencyButton = document.querySelector('.currency-button.active input');
  const selectedCurrency = selectedCurrencyButton ? selectedCurrencyButton.value : 'EUR';

  let priceId;
  if (selectedCurrency === 'EUR') {
    console.log("eur");
    priceId = Meteor.settings.public.PRICE_ID_EUR;
  } else if (selectedCurrency === 'USD') {
    console.log("usd");
    priceId = Meteor.settings.public.PRICE_ID_USD;
  }

  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement,
  });

  if (error) {
    console.log("Error occurred:", error);

    // Hide spinner and enable button
    document.getElementById('submit-button').innerHTML = 'Submit Payment';
    document.getElementById('submit-button').disabled = false;
    return;
  }

  Meteor.call('createSubscription', paymentMethod.id, priceId, async (err, clientSecret) => {
    if (err) {
      console.log("Server-side error:", err);

      // Hide spinner and enable button
      document.getElementById('submit-button').innerHTML = 'Submit Payment';
      document.getElementById('submit-button').disabled = false;
      return;
    }

    if (clientSecret) {
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);
      if (confirmError) {
        console.log("3D Secure confirmation failed:", confirmError);

        // Hide spinner and enable button
        document.getElementById('submit-button').innerHTML = 'Submit Payment';
        document.getElementById('submit-button').disabled = false;
        return;
      } else {
        console.log("Subscription created with 3D Secure.");
        Meteor.call('updateUserToPaying');
        $("#checkoutModal").hide();
        $(".modal-backdrop").hide();
      }
    } else {
      console.log("Subscription created without 3D Secure.");
      Meteor.call('updateUserToPaying');
    }

    // Hide spinner and enable button
    document.getElementById('submit-button').innerHTML = 'Submit Payment';
    document.getElementById('submit-button').disabled = false;
  });
}

});

Template.body.events({
  'click #switchToEnglish': function() {
     TAPi18n.setLanguage('en')
       .done(function () {
         console.log("Language switched to English");
       })
       .fail(function (error_message) {
        // console.log(error_message);
       });
   },
   'click #switchToFrench': function() {
     TAPi18n.setLanguage('fr')
       .done(function () {
         console.log("Language switched to French");
       })
       .fail(function (error_message) {
      //   console.log(error_message);
       });
   }
});

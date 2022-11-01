//=========================
//       IMPORTS     
//=========================   

// For some reason the gsap module it's not working on  the server, I have to figure out how send it to the model, but this
// is just animations, at the end are the animation code in comments to avoid any error.
// import { gsap }  from "../../node_modules/gsap/all.js";
//=========================
//   VARIABLES & CONST     
//=========================    

// ----- Abstract Variables -----
const primaryColor = `rgb(86, 124, 228)`;


// ---- Form Register Variables -----
    // Forms Tag


    // Inputs Const for register form
    const usernameRegister = document.querySelector(`#input-username_register`);
    const usernameLabel = document.querySelector(`#username-label_register`);
    const checkIcon = document.querySelector(`.fa-circle-check`);


    const emailRegister = document.querySelector(`#input-email_register`);
    const emailLabel = document.querySelector(`#email-label_register`);
    const emailIcon = document.querySelector(`.fa-at`)

    const pswdRegister = document.querySelector(`#input-pswd_register`);
    const pswdLabel = document.querySelector(`#pswd-label_register`);
    const eyeIconRegister = document.getElementById(`eye-pswd_register`);
    

    // Sign In & Register Btns & Form
    const signIn = document.querySelector(`.sign-in`);
    const signInForm = document.querySelector(`.sign-in-form`);

    const register = document.querySelector(`.register`);
    const registerForm = document.querySelector(`.register-form`);

    // Inputs Const for login form
    const emailLogin = document.querySelector(`.login-input`);
    const pswdLogin = document.querySelector(`.input-pswd_login`);
    const eyeIconLogin = document.getElementById(`eye-pswd_login`);


    // Btns Const for login 
    const signInBtn = document.querySelector(`.sign-in_btn`);
    const registerBtn = document.querySelector(`.register_btn`);


    // Check Email Characters Const
    const er = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;



//=========================
//    EVENTS LISTENERS    
//=========================  

// ----- Event listener for the Forms -----
eventListener();
function eventListener() {
    // Disable Sign In Btn
    document.addEventListener(`DOMContentLoaded`, disableBtn);

    // Inputs Fields Validations
    usernameRegister.addEventListener(`blur`, formValidationUsername);
    emailRegister.addEventListener(`blur`, formValidationEmail);
    pswdRegister.addEventListener(`blur`, formValidationPswd);
}


// ----- Event Listener Changing Login & Register -----
signIn.onclick = () => {
    registerForm.style.display = `none`;
    register.style.color = `white`;
    
    signInForm.style.display = `block`;
    signIn.style.color = primaryColor;

}

register.onclick = () => {
    register.style.color = primaryColor;
    registerForm.style.display = `block`

    signInForm.style.display = `none`;
    signIn.style.color = `white`;

}


// ----- Event Listener Show & Hide Password
eyeIconRegister.onclick = () => {
    if(pswdRegister.type === `password`) {
        pswdRegister.setAttribute(`type`, `text`);
        eyeIconRegister.classList.remove(`fa-eye`);
        eyeIconRegister.classList.add(`fa-eye-slash`);
    }else {
        pswdRegister.setAttribute(`type`, `password`);
        eyeIconRegister.classList.remove(`fa-eye-slash`);
        eyeIconRegister.classList.add(`fa-eye`);
    };
};

eyeIconLogin.onclick = () => {
    if(pswdLogin.type === `password`) {
        pswdLogin.setAttribute(`type`, `text`);
        eyeIconLogin.classList.remove(`fa-eye`);
        eyeIconLogin.classList.add(`fa-eye-slash`);
    }else {
        pswdLogin.setAttribute(`type`, `password`);
        eyeIconLogin.classList.remove(`fa-eye-slash`);
        eyeIconLogin.classList.add(`fa-eye`);
    };
};



//=========================
//      FUNCTIONS   
//=========================  

// ----- Disable Btn for register
function disableBtn() { 

    registerBtn.disabled = true;
    registerBtn.style.cursor = `not-allowed`;
    registerBtn.style.backgroundColor = `rgb(122, 153, 238)`;
 };


// ----- Form Validation for register -----
function formValidationUsername(e){
    if(e.target.value.length > 5) {

        e.target.style.borderColor = `#4461F2`;
        usernameLabel.style.color = `#4461F2`;
        checkIcon.style.color = `#63D399`;

        enableBtn();
    } else {
        e.target.style.borderColor = `#F23501`;
        usernameLabel.style.color = `#F23501`;
        checkIcon.style.color = `#F23501`;
    };
};

function formValidationEmail(e){

    if(er.test(e.target.value)) {
        e.target.style.borderColor = `#4461F2`;
        emailLabel.style.color = `#4461F2`;
        emailIcon.style.color = `#63D399`
        enableBtn();
    } else {

        e.target.style.borderColor = `#F23501`;
        emailLabel.style.color = `#F23501`;
        emailIcon.style.color = `#F23501`;
    };
};

function formValidationPswd(e) {
    if(e.target.value.length > 8) {

        e.target.style.borderColor = `#4461F2`;
        pswdLabel.style.color = `#4461F2`;
        eyeIconRegister.style.color = `#63D399`;

        enableBtn();
    } else {

        e.target.style.borderColor = `#F23501`;
        pswdLabel.style.color = `#F23501`;
        eyeIconRegister.style.color = `#F23501`;
    };
};

function showError(appendContainer, errMessage) {
    const errorDiv = document.createElement(`div`);
    const errorMessage = document.createElement(`p`);

    errorDiv.classList.add(`error-message-container`);
    errorMessage.classList.add(`error-message`);

    appendContainer.appendChild(errorDiv);
    errorDiv.appendChild(errorMessage);

    errorMessage.innerText = errMessage;

    setTimeout(() => {
        appendContainer.removeChild(errorDiv);
    }, 5000);
}

// ----- Enable Btn for register -----
function enableBtn() {
    if(er.test(emailRegister.value) && pswdRegister.value !== ``) {
        registerBtn.disabled = false;
        registerBtn.style.cursor = `pointer`;
        registerBtn.style.backgroundColor = primaryColor;
    }
};

// ----- Register Function -----
function handleRegisterFormSubmit(e) {
    e.preventDefault();

    // Get data inputs
    const username = usernameRegister.value;
    const email = emailRegister.value;
    const password = pswdRegister.value;

    const userDataObj = {username, email, password};

    fetch(`api/player`, {
        method: `POST`,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
    },
    body: JSON.stringify(userDataObj)
    })
        .then(response => {
            if(response.ok) return response.json();

            alert(`Error: ` + response.statusText);
    })
        .then(postResponse => {
            console.log(postResponse);
            registerForm.style.display = `none`;
            register.style.color = `white`;
    
            signInForm.style.display = `block`;
            signIn.style.color = primaryColor;
            alert(`You create an account`);
    });

    usernameRegister.value =  ` `;
    emailRegister.value = ` `;
    pswdRegister.value = ` `;
}

// ----- Login Function -----
function handleLoginFormSubmit(e) {
    e.preventDefault()

    const email = emailLogin.value;
    const password = pswdLogin.value;

    const loginData = {email, password};

    fetch(`api/player/login`, {
        method: `POST`,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
    },
        body: JSON.stringify(loginData)
    })
        .then(response => {
            if(response.ok) return response.json();

            // showError(signInForm, `Email or password is incorrect`);

            // alert(`Error: ` + response.statusText);
        })
        .then(postResponse => {
            console.log(postResponse);
            if(postResponse === undefined) {
                showError(signInForm, `Email or password is incorrect`);
                
                emailLogin.value = ``;
                pswdLogin.value = ``;
            } else {
                alert(`You logged in!`);

                emailLogin.value = ``;
                pswdLogin.value = ``;
            }

            // location.replace(`http://localhost:3001/api/player`);
        })
}

registerForm.addEventListener(`submit`, handleRegisterFormSubmit);

signInForm.addEventListener(`submit`, handleLoginFormSubmit);


//=========================
//     GSAP ANIMATION    
//=========================   

// ----- Model viewer animation ------
// function mvAnimation() {

//     const modelViewer = document.querySelector(`.model-viewer`);

//     setTimeout(() => {
//         modelViewer.style.display = `block`;
//     }, 2000);
//     }
//     mvAnimation();


// ----- Duration Template -----
const tl = gsap.timeline({defaults:{duration: 1.5}});

// Elements Animation when the page is loading
tl.from(`.title-section`, {y: -50, opacity:0});
tl.from(`.login-section`, {y: 50, opacity: 0}, `-=1.1`);

function formAnimation(form) {
    tl.to(form, {y: 50, opacity: 0, duration: 0.5}.reversed(true));
};

//=========================
//     TIPPY TOOLTIP    
//=========================  

tippy(`#eye-pswd_login`, {
    content: `Show Password`
});

tippy(`#eye-pswd_register`, {
    content: `More than 8 characters`
});

tippy(`#icon-username`, {
    content: `More than 5 characters`
});

tippy(`#icon-email`, {
    content: `Put a valid email`
});
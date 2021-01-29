// Config | PLEASE DO NOT USE MY CONFIG
var firebaseConfig = {
    apiKey: "AIzaSyASOZNuboYfzw1CV2gOKavjiZnH4pzoiG0",
    authDomain: "fir-basic-example.firebaseapp.com",
    projectId: "fir-basic-example",
    storageBucket: "fir-basic-example.appspot.com",
    messagingSenderId: "933564106583",
    appId: "1:933564106583:web:73ae94011620c244e12012",
    measurementId: "G-VWCJSBXKSJ"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

//Request firestore
let db = firebase.firestore()
//Request auth
let provider = new firebase.auth.GoogleAuthProvider();

//Setup vars
let user
let userData
let displayData = {};
let selectedChannel = 'main';

//Const
const maxMessages = 100; //Max number of messages to load
const maxCombinedMessagesNum = 10; //The max number of messages that can be combined
const maxTimeDifBetweenCombinedMessages = 60 * 5; //Max time between combined messages

//Define on load
let userInputBox, displayUser, signInBlock, channelSelect, displayAllUsers, mainContentDiv
function onLoad() {
    displayUser = document.getElementById('displayUser')
    signInBlock = document.getElementById('signInBlock')
    userInputBox = document.getElementById('messageInputBox')
    channelSelect = document.getElementById('channelSelect')
    displayAllUsers = document.getElementById('displayAllUsers')
    mainContentDiv = document.getElementsByClassName("mainContent")[0]

    //To add focus to typing if not typing in correct box
    document.addEventListener("keydown", function(key) {
        if (document.body === document.activeElement) {
            //Change focus if regular key
            if (key.code.includes("Key")) {
                //Random stackoverflow function because focusing at the end of the text is such a huge issue ahghghghgh
                function placeCaretAtEnd(el) {
                    if (typeof window.getSelection != "undefined"
                        && typeof document.createRange != "undefined") {
                        var range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        var sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else if (typeof document.body.createTextRange != "undefined") {
                        var textRange = document.body.createTextRange();
                        textRange.moveToElementText(el);
                        textRange.collapse(false);
                        textRange.select();
                    }
                }

                userInputBox.focus();
                placeCaretAtEnd(userInputBox);
            }
        }
    })

    userInputBox.addEventListener("keydown", function(key) {
        if (key && key.key === 'Enter' && !key.getModifierState('Shift')) {
            sendMessage()
        }
    })

    mainContentDiv.addEventListener("scroll", function() {
        lastPos = mainContentDiv.scrollTop
        scrollingWithContent = (mainContentDiv.scrollTop) > (mainContentDiv.scrollHeight - mainContentDiv.offsetHeight - 15)
    })
    scrollDown()
    fixDumbCss()
}

function fixDumbCss() {
    let baseContentDiv = document.getElementsByClassName("baseDiv")[0]
    let topContentDiv = document.getElementsByClassName("topContent")[0]
    let centerContentDiv = document.getElementsByClassName("centerContent")[0]
    centerContentDiv.style.height = (baseContentDiv.clientHeight - topContentDiv.clientHeight) + "px"

    window.requestAnimationFrame(fixDumbCss)
}

let scrollingWithContent = true, lastPos = 0
function scrollDown() {
    if (scrollingWithContent) {
        window.requestAnimationFrame(function() {
            mainContentDiv.scrollTo(0, mainContentDiv.scrollHeight)
        })
    } else {
        mainContentDiv.scrollTo(0, lastPos)
    }
}

function removeSignInBlock() {
    displayUser.innerText = "Signed In As: " + user.displayName
    signInBlock.style.display = 'none'
    displayUser.style.display = 'block'
}

function userSignIn() {
    firebase.auth()
        .signInWithPopup(provider)
        .then((result) => {
            //Worked
            user = result.user;

            let doc = db.collection("users").doc(user.uid)

            doc.get().then((snapshot => {
                if (snapshot.exists) {
                    //Already has user data
                    userData = snapshot.data();
                    removeSignInBlock()
                } else {
                    //Need to make user data
                    let newData = {
                        displayName: user.displayName,
                        displayImage: user.photoURL,
                        status: 0,
                        motd: "",
                        admin: false,
                    }
                    doc.set(newData).then(() => {
                        userData = newData
                        removeSignInBlock()
                    }).catch(issue => {
                        console.log("Throttling issue likely: " + issue)
                    })
                }
            })).catch(issue => {
                console.log("Throttling issue likely: " + issue)
            })

            fetchMessagesInit()
            fetchUsersInit()
        }).catch((error) => {
        //Failed
        console.log("Failed auth: " + error.code)
        console.log(error)
    });

}

function sendMessage() {
    let userInput = userInputBox.innerText
    if (!user) {
        alert('Sign in first')
    } else if (userInput.length > 0 && userInput.trim().length > 0) {
        let messages = db.collection("channels").doc(selectedChannel).collection("messages")
        messages.add({
            created: firebase.firestore.FieldValue.serverTimestamp(),
            content: userInput,
            uId: user.uid,
            displayName: user.displayName,
            displayImage: user.photoURL,
        })
    }

    userInputBox.innerText = ""

    setTimeout(function() {
        userInputBox.innerText = "" //Fix weird issue that chrome has with whitespace, idk why
    }, 0)
}


function displayUserSnapshot(snapshot) {
    displayAllUsers.innerHTML = ""
    snapshot.forEach((doc) => {
        let data = doc.data()
        let div = document.createElement("div")

        let height = 25;

        let img = document.createElement("img")
        img.src = data.displayImage;
        img.width = height;
        img.height = height;
        img.style.float = "left"

        let p = document.createElement("p")
        p.innerText = data.displayName
        p.style.fontSize = height + "px"
        p.style.float = "left"
        p.style.margin = '0px';
        p.style.paddingLeft = "8px"

        div.append(img, p)
        displayAllUsers.appendChild(div)
    })
}

async function fetchUsersInit() {
    let users = db.collection("users").orderBy("displayName", "asc").limit(100)
    let usersSnapshot = await users.get()
    displayUserSnapshot(usersSnapshot)

    users.onSnapshot((snapshot) => {
        displayUserSnapshot(snapshot)
    })
}

async function fetchMessagesInit() {
    let channels = db.collection("channels")
    let channelsSnapshot = await channels.get()

    channelsSnapshot.forEach((data) => {
        let option = document.createElement("button")
        let id = data.id;
        option.innerText = id;
        option.onclick = function() {
            selectedChannel = id;
            swapSelectedChannel()
        }
        channelSelect.appendChild(option)
    })

    selectedChannel = "main";

    swapSelectedChannel()
    displayMessagesData()
}

function swapSelectedChannel() {
    if (displayData) {
        if (displayData.snapshot) {
            displayData.snapshot()
        }
    }

    let thisChannel = selectedChannel

    let channels = db.collection("channels")
    let messages = channels.doc(thisChannel).collection("messages")

    let query = messages.orderBy("created", "desc").limit(maxMessages + 1); //most recent message first, then the last x

    displayData = {
        data: null,
        snapshot: null,
    }
    query.get() //First get to catch up
        .then((snapshot) => {
            displayMessageSnapshot(snapshot, thisChannel)
        })


    displayData.snapshot = query.onSnapshot((snapshot) => {
        displayMessageSnapshot(snapshot)
    })

    lastHeight = 0
}

function displayMessageSnapshot(snapshot) {
    let messages = []
    snapshot.forEach(function(doc) {
        let data = doc.data()

        if (data.created && data.content && data.content.length > 0) {
            let date = new Date(data.created.seconds * 1000)
            let timestamp = date.toTimeString()
            let formatted = timestamp.split(" ")[0]
            let asString = formatted + " " + data.displayName + ": " + data.content
            messages.splice(0, 0, {
                content: asString,
                uId: data.uId,
                seconds: data.created.seconds,
            })
        }
    });

    while (messages.length > maxMessages) {
        messages.shift()
    }

    displayData.data = messages
    displayMessagesData()
}

function displayMessagesData() {
    let messages = displayData && displayData.data

    if (!messages) {
        return
    }

    let displayMessages = document.getElementById('displayMessages')
    displayMessages.innerHTML = ""

    let lastData
    messages.forEach(function(value) {
        //Checks for criteria in which to combine messages by the same person if the time combined & number of combined
        //is within constants (makes chat nicer)
        if (lastData && lastData.uId === value.uId &&
            (value.seconds - lastData.begin) < maxTimeDifBetweenCombinedMessages &&
            lastData.num < maxCombinedMessagesNum)
        {
            lastData.num++;
            lastData.p.innerText = lastData.p.innerText + "\n" + value.content
        } else {
            let div = document.createElement("div")
            let p = document.createElement("p")

            p.setAttribute("class", "messageContent")
            div.setAttribute("class", "message")
            p.innerText = value.content

            div.appendChild(p)
            displayMessages.appendChild(div)


            lastData = {
                p: p,
                uId: value.uId,
                num: 1,
                begin: value.seconds,
            }
        }
    })
    scrollDown()
}

function displayNewMessage() {

}
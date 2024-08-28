const express = require('express')

const path = require('path')

const {open} = require('sqlite')

const sqlite3 = require('sqlite3')

const app = express()

app.use(express.json())

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server Running at: http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

// Authenticate Token

const authenticateToken = (request, response, next) => {
  let jwtToken

  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        const username = payload.username

        request.username = username

        next()
      }
    })
  }
}

// API - 1 -- Register User

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  // Checking if user already registered or not

  const checkUserData = `SELECT * FROM user WHERE username = '${username}';`

  const getCheckedUserData = await db.get(checkUserData)

  const findUser = `SELECT MAX(user_id) FROM user`

  const findUserId = await db.get(findUser)

  const getUserId = findUserId['MAX(user_id)'] + 1

  const hashedPassword = await bcrypt.hash(password, 10)

  if (getCheckedUserData === undefined) {
    if (password.length < 6) {
      response.status(400)

      response.send('Password is too short')
    } else {
      const createNewUser = `INSERT INTO user(user_id, name, username, password, gender)
        VALUES(
          '${getUserId}',
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
        );`

      const addUserIntoDB = await db.run(createNewUser)

      console.log(addUserIntoDB)

      response.status(200)

      response.send('User created successfully')
    }
  } else {
    response.status(400)

    response.send('User already exists')
  }
})

// API - 2 -- Login Existing User

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  // Check whether user is already registered or not

  const checkUser = `SELECT * FROM user WHERE username = '${username}';`

  const userDetails = await db.get(checkUser)

  const findUserId = `SELECT user_id FROM user WHERE username = '${username}'`

  const userId = await db.get(findUserId)

  // const userIdValidation = userId.user_id

  if (userDetails !== undefined) {
    const validateUserPassword = await bcrypt.compare(
      password,
      userDetails.password,
    )

    if (validateUserPassword === true) {
      const payload = {
        username: username,
      }

      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')

      response.send({jwtToken})
    } else {
      response.status(400)

      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// API - 3 -- GET the latest tweets

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  let {username} = request

  console.log(username)

  const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

  const userId = await db.get(getUserID)

  console.log(userId.user_id)

  const getFollowingUsersId = `SELECT following_user_id FROM follower WHERE follower_user_id = '${userId.user_id}';`

  const followingUserId = await db.all(getFollowingUsersId)

  //console.log(followingUserId)

  let allFollowingUserId = []

  for (let eachUserId of followingUserId) {
    allFollowingUserId.push(eachUserId.following_user_id)
  }

  console.log(allFollowingUserId)

  const getTweets = `SELECT * FROM tweet WHERE user_id IN (${allFollowingUserId.join(
    ',',
  )}) ORDER BY date_time DESC LIMIT 4 OFFSET 0`

  const displayLatestTweets = await db.all(getTweets)

  //console.log(displayLatestTweets)

  let followingTweets = []

  for (let eachTweet of displayLatestTweets) {
    const findUserName = `SELECT username FROM user WHERE user_id = '${eachTweet.user_id}';`

    let userName = await db.get(findUserName)

    followingTweets.push({
      username: userName.username,
      tweet: eachTweet.tweet,
      dateTime: eachTweet.date_time,
    })
  }

  // let allFollowingUserTweets = []

  //console.log(allFollowingUserTweets)

  response.send(followingTweets)
})

// API - 4 -- List of people whom the user follows (Following)

app.get('/user/following/', authenticateToken, async (request, response) => {
  let {username} = request

  console.log(username)

  const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

  const userId = await db.get(getUserID)

  console.log(userId.user_id)

  const getFollowingUsers = `SELECT following_user_id FROM follower WHERE follower_user_id = '${userId.user_id}';`

  const allFollowingUsers = await db.all(getFollowingUsers)

  console.log(allFollowingUsers)

  //let getUserName

  //let userName = await db.get(getUserName)

  //console.log(userName)

  let allFollowingUsersNames = []

  let allUserId = []

  //let findUserName = eachId => {
  // getUserName = `SELECT username AS name FROM user WHERE user_id = '${eachId}';`
  //}

  /* let sendEachId = allUserId.map(eachUserId => {
    console.log('Hi')

    findUserName(eachUserId)
  }) */

  let findNameOfFollowingUser = allFollowingUsers.map(eachId => {
    const userId = eachId.following_user_id

    allUserId.push(userId)
  })

  findNameOfFollowingUser

  console.log(allUserId)

  for (let eachId of allUserId) {
    const getUserName = `SELECT name AS name FROM user WHERE user_id = '${eachId}';`

    const eachName = await db.get(getUserName)

    allFollowingUsersNames.push(eachName)
  }

  response.send(allFollowingUsersNames)
})

// API - 5 -- List of people who follows the user (Followers)

app.get('/user/followers/', authenticateToken, async (request, response) => {
  let {username} = request

  const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

  const userId = await db.get(getUserID)

  const getFollowerUsers = `SELECT follower_user_id FROM follower WHERE following_user_id = '${userId.user_id}';`

  const allFollowerUsers = await db.all(getFollowerUsers)

  let allFollowersId = []

  let allFollowersNames = []

  for (let eachUserId of allFollowerUsers) {
    const findEachUserName = `SELECT name FROM user WHERE user_id = '${eachUserId.follower_user_id}';`

    const eachFollowerName = await db.get(findEachUserName)

    allFollowersNames.push(eachFollowerName)
  }

  response.send(allFollowersNames)
})

// API - 6 -- Returns the tweets of the users whom the user follows return the tweet, likes count, replies count and date-time (Following)

app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  let {username} = request

  let {tweetId} = request.params

  console.log(username)

  const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

  const userId = await db.get(getUserID)

  console.log(userId.user_id)

  const getFollowingUsersId = `SELECT following_user_id FROM follower WHERE follower_user_id = '${userId.user_id}';`

  const followingUserId = await db.all(getFollowingUsersId)

  let followingUsers = []

  for (let eachId of followingUserId) {
    followingUsers.push(eachId.following_user_id)
  }

  console.log(followingUsers)

  console.log(tweetId)

  const findTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`

  const tweetUserId = await db.get(findTweetUserId)

  console.log(tweetUserId)

  const checkFollowedUser = followingUsers.includes(tweetUserId.user_id)

  console.log(checkFollowedUser)

  if (checkFollowedUser === false) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const getTweetDetails = `SELECT tweet, (SELECT COUNT(like_id) FROM like WHERE tweet_id = '${tweetId}') AS likes, (SELECT COUNT(reply_id) FROM reply WHERE tweet_id = '${tweetId}') AS replies, date_time AS dateTime FROM tweet WHERE tweet_id = '${tweetId}'`

    const tweetDetails = await db.get(getTweetDetails)

    console.log(tweetDetails)

    response.send(tweetDetails)
  }
})

// API - 7 -- If the user requests a tweet of a user he is following, return the list of usernames who liked the tweet

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const {tweetId} = request.params

    console.log(username)

    const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

    const userId = await db.get(getUserID)

    console.log(userId.user_id)

    const getFollowingUsersId = `SELECT following_user_id FROM follower WHERE follower_user_id = '${userId.user_id}';`

    const followingUserId = await db.all(getFollowingUsersId)

    let followingUsers = []

    for (let eachId of followingUserId) {
      followingUsers.push(eachId.following_user_id)
    }

    console.log(followingUsers)

    console.log(tweetId)

    const findTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`

    const tweetUserId = await db.get(findTweetUserId)

    console.log(tweetUserId)

    const checkFollowedUser = followingUsers.includes(tweetUserId.user_id)

    console.log(checkFollowedUser)

    if (checkFollowedUser === false) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getTweetDetails = `SELECT user_id FROM like WHERE tweet_id = '${tweetId}';`

      const allTweetDetails = await db.all(getTweetDetails)

      //console.log(allTweetDetails)

      let likedUsersId = []

      for (let eachId of allTweetDetails) {
        likedUsersId.push(eachId.user_id)
      }

      //console.log(likedUsersId)

      let likedUserNames = []

      for (let eachId of likedUsersId) {
        const getLikedUserNames = `SELECT username FROM user WHERE user_id = '${eachId}';`

        const userNames = await db.get(getLikedUserNames)

        likedUserNames.push(userNames.username)
      }

      //console.log(likedUserNames)

      response.send({likes: likedUserNames})
    }
  },
)

// API - 8 -- If the user requests a tweet of a user he is following, return the list of replies.

app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request

    // console.log(username)

    const getUserID = `SELECT user_id FROM user WHERE username = '${username}';`

    const userId = await db.get(getUserID)

    // console.log(userId.user_id)

    const getFollowingUsersId = `SELECT following_user_id FROM follower WHERE follower_user_id = '${userId.user_id}';`

    const followingUserId = await db.all(getFollowingUsersId)

    let followingUsers = []

    for (let eachId of followingUserId) {
      followingUsers.push(eachId.following_user_id)
    }

    // console.log(followingUsers)

    // console.log(tweetId)

    const findTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`

    const tweetUserId = await db.get(findTweetUserId)

    // console.log(tweetUserId)

    if (tweetUserId === undefined) {
      response.send('Invalid Request')
    }

    const checkFollowedUser = followingUsers.includes(tweetUserId.user_id)

    // console.log(checkFollowedUser)

    // SELECT reply, user_id FROM reply INNER JOIN user user_id ON reply.user_id = user_id WHERE tweet_id = '${tweetId}'

    if (checkFollowedUser === false) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      // SELECT reply, user_id FROM reply INNER JOIN user user_id ON reply.user_id = user_id WHERE tweet_id = '${tweetId}'

      const getTweetReplyDetails = `SELECT * FROM reply WHERE tweet_id = '${tweetId}';`

      let allTweetsList = []

      const tweets = await db.all(getTweetReplyDetails)

      for (let eachTweet of tweets) {
        const findUserName = `SELECT name FROM user WHERE user_id = '${eachTweet.user_id}';`

        const getUserName = await db.get(findUserName)

        // console.log(getUserName.name)

        allTweetsList.push({
          name: getUserName.name,
          reply: eachTweet.reply,
        })
      }

      //console.log(tweets)

      //console.log(allTweetsList)

      const replies = allTweetsList

      //console.log({replies})

      response.send({replies})
    }
  },
)

// API - 9 -- Returns a list of all tweets of the user

app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request

  const getUserId = `SELECT user_id FROM user WHERE username = '${username}'`

  const userId = await db.get(getUserId)

  //console.log(userId.user_id)

  let allUserTweets = []

  const getTweetDetails = `SELECT * FROM tweet WHERE user_id = '${userId.user_id}';`

  const tweetDetails = await db.all(getTweetDetails)

  // console.log(tweetDetails)

  for (let eachUserTweet of tweetDetails) {
    let getLikesOfTweet = `SELECT COUNT(like_id) FROM like WHERE tweet_id = '${eachUserTweet.tweet_id}';`

    let likesCount = await db.get(getLikesOfTweet)

    let getRepliesOfTweet = `SELECT COUNT(reply_id) FROM reply WHERE tweet_id = '${eachUserTweet.tweet_id}';`

    let repliesCount = await db.get(getRepliesOfTweet)

    // console.log(likesCount)

    // console.log(repliesCount)

    allUserTweets.push({
      tweet: eachUserTweet.tweet,
      likes: likesCount['COUNT(like_id)'],
      replies: repliesCount['COUNT(reply_id)'],
      dateTime: eachUserTweet.date_time,
    })
  }

  // console.log(allUserTweets)

  response.send(allUserTweets)
})

// API - 10 -- create a tweet in the tweet table

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request

  const {tweet} = request.body

  const findUserId = `SELECT user_id FROM user WHERE username = '${username}';`

  const getUserId = await db.get(findUserId)

  const userId = getUserId.user_id

  const findMAXTweetId = `SELECT MAX(tweet_id) FROM tweet`

  const maxTweetID = await db.get(findMAXTweetId)

  const tweetId = maxTweetID['MAX(tweet_id)'] + 1

  const dateTime = new Date()

  console.log(dateTime)

  const year = dateTime.getFullYear()

  let day = dateTime.getDate()

  if (day < 10) {
    day = '0' + day
  } else {
    day = day
  }

  let month = dateTime.getDay() - 1

  let hours = dateTime.getHours()

  if (hours < 10) {
    hours = '0' + hours
  } else {
    hours = hours
  }

  let minutes = dateTime.getMinutes()

  if (minutes < 10) {
    minutes = '0' + minutes
  } else {
    minutes = minutes
  }

  let seconds = dateTime.getSeconds()

  if (seconds < 10) {
    seconds = '0' + seconds
  } else {
    seconds = seconds
  }

  const dateFormat =
    year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds

  //console.log(dateFormat)

  const addNewTweet = `INSERT INTO tweet(tweet_id, tweet, user_id, date_time) VALUES(
    '${tweetId}',
    '${tweet}',
    '${userId}',
    '${dateFormat}'
  )`

  const newTweet = await db.run(addNewTweet)

  response.send('Created a Tweet')
})

// API - 11 -- Delete a tweet

app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {username} = request

    const {tweetId} = request.params

    const verifyUserTweet = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`

    const getVerifyUserId = await db.get(verifyUserTweet)

    const verifyUserId = getVerifyUserId.user_id

    console.log(verifyUserId)

    const findUserId = `SELECT user_id FROM user WHERE username = '${username}';`

    const getUserId = await db.get(findUserId)

    const userId = getUserId.user_id

    console.log(userId)

    if (verifyUserId === userId) {
      const deleteTweetQUery = `DELETE FROM tweet WHERE tweet_id = '${tweetId}';`

      const deleteTweet = await db.run(deleteTweetQUery)

      response.send('Tweet Removed')
    } else {
      response.status(401)

      response.send('Invalid Request')
    }
  },
)

module.exports = app

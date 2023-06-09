const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1); // Exit Code 1 indicates that a container shut down, either because of an application failure.
});

const app = require("./app");

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
// 소켓 io
// Add this

const { promisify } = require("util");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");
const AudioCall = require("./models/audioCall");
const VideoCall = require("./models/videoCall");
// const { socket } = require("../chat-app-latest/src/socket");

// Add this 소켓 io
// Create an io server and allow for CORS from http://localhost:3000 with GET and POST methods
const io = new Server(server, {
  cors: {
    origin: "*", // "http://localhost:3000"
    methods: ["GET", "POST"],
  },
});

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    // useNewUrlParser: true, // The underlying MongoDB driver has deprecated their current connection string parser. Because this is a major change, they added the useNewUrlParser flag to allow users to fall back to the old parser if they find a bug in the new parser.
    // useCreateIndex: true, // Again previously MongoDB used an ensureIndex function call to ensure that Indexes exist and, if they didn't, to create one. This too was deprecated in favour of createIndex . the useCreateIndex option ensures that you are using the new function calls.
    // useFindAndModify: false, // findAndModify is deprecated. Use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead.
    // useUnifiedTopology: true, // Set to true to opt in to using the MongoDB driver's new connection management engine. You should set this option to true , except for the unlikely case that it prevents you from maintaining a stable connection.
  })
  .then((con) => {
    console.log("DB Connection successful");
  })
  .catch((err)=>{
    console.log("err");
  });

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});



// Add this 소켓 io 작성

//Listen for when the client connects via socket.io-client
 io.on("connection", async (socket) => {
  console.log(JSON.stringify(socket.handshake.query));
  const user_id = socket.handshake.query["user_id"];

  console.log(`User connected ${socket.id}`);

  if (user_id != null && Boolean(user_id)) {
    try {
      User.findByIdAndUpdate(user_id, {
        socket_id: socket.id,
        status: "Online",
      });
    } catch (e) {
      console.log(e);
    }
  }

// io.on("connection", async (socket) => {
//   const user_id  = socket.handshake.query("usedr_id");
//   const socket_id = socket.id;

//   console.log(`User connected ${socket_id}`)

//   if(user_id){
//     await User.findByIdAndUpdate(user_id,{socket_id,});
//   }
 

  // We can write our socket event listeners in here...
  // 대충 소켓 io의 이벤트 리스너를 작성한다고...

  // socket.on("friend_request", async (data) => {
  //   const to = await User.findById(data.to).select("socket_id");
  //   const from = await User.findById(data.from).select("socket_id");

  //   // create a friend request
  //   await FriendRequest.create({
  //     sender: data.from,
  //     recipient: data.to,
  //   });
  //   // emit event request received to recipient
  //   io.to(to?.socket_id).emit("new_friend_request", {
  //     message: "New friend request received",
  //   });
  //   io.to(from?.socket_id).emit("request_sent", {
  //     message: "Request Sent successfully!",
  //   });
  // });

  socket.on("friend_request", async (data) =>{
    console.log(data.to);

    // data => {to,from}
    // 누가 요청했고 누가 받았고 그런거 구현인듯
    const to_user = await User.findById(data.to).select("socket_id");
    const from_user = await User.findById(data.from).select("socket_id");

    // 친구요청 이벤트 만들기
    await FriendRequest.create({
      sender : data.from,
      recipient : data.to,
    })
    
    // emit event => "new_friend_request"
    io.to(to_user.socket_id).emit("new_friend_request",{
      // 수신자와 발신자 정보를 포함할 요청 id 입니다.
      message : "New Friend Request Received"
    } );

    // emit event => "request_user"
    io.to(from_user.socket_id).emit("request_sent",{
      // 수신자와 발신자 정보를 포함할 요청 id 입니다.
      message : "Request sent successfully!"
    } );
    // emit evnet => request
    // 특정 이벤트를 소켓 id로 보낼거임.
    // 또는 특정 클라이언트에게 다음과 같이 말할 수 있음. 그리고 해당 이름 전달

  });
  socket.on("accept_request", async (data) =>{
     // 1) 서버에서 이벤트를 수신하면 요청을 수락하는거임

    console.log(data,"accept_request");

    const request_doc = await User.findById(request_doc.sender);
    // 2) 그러기 위해서 요청문서를 가져옴.
    
    console.log(request_doc,"request_doc");

    // request_id

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);
    // 3) 그것을 위해서 수신자와 발신자 문서를 가져옴.

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);
    // 4) 그들의 기록을 업데이트.(friend 배열에)

    await receiver.save({new : true , validateModifiedOnly : true});
    await sender.save({new : true , validateModifiedOnly : true});
    // 5) 이러캐 작성하면 업데이트된 최신문서 반환. 그래서 옵션에 new:true 주는거
    // 6) validateModifiedOnly는 쿼리에서 수정된것에만 유효성검사 지정
    // 위에서 friend 필드를 수정했으니 유효성 검사 기능은 친구 필드에서만

    await FriendRequest.findByIdAndDelete(data.request_id);
    // 7) 이제 수락을 하던 거절을 하던 친구 요청창이 없어져야함. 그러기 위해 일단 대기 작성
    // FriendRequest에서 내 아이디를 찾아서 삭제하는 로직. 삭제하려는 요청 문서의 ID 전달

    io.to(sender.socket_id).emit("request_accepted",{
      message : "Friend Request Accepted",
    });
    io.to(receiver.socket_id).emit("request_accepted",{
      message : "Friend Request Accepted",
    });
    // 요청이 수락됬다고 각 사용자에게 이벤트를 내보내는 부분 

  });

  socket.on("end", function () {
    console.log("Closing connection");
    socket.disconnect(0);
    // 특성 소켓에 대한 연결 닫음. 

  })

  // socket.on("accept_request", async (data) => {
  //   // accept friend request => add ref of each other in friends array
  //   console.log(data);
  //   const request_doc = await FriendRequest.findById(data.request_id);

  //   console.log(request_doc);

  //   const sender = await User.findById(request_doc.sender);
  //   const receiver = await User.findById(request_doc.recipient);

  //   sender.friends.push(request_doc.recipient);
  //   receiver.friends.push(request_doc.sender);

  //   await receiver.save({ new: true, validateModifiedOnly: true });
  //   await sender.save({ new: true, validateModifiedOnly: true });

  //   await FriendRequest.findByIdAndDelete(data.request_id);

  //   // delete this request doc
  //   // emit event to both of them

  //   // emit event request accepted to both
  //   io.to(sender?.socket_id).emit("request_accepted", {
  //     message: "Friend Request Accepted",
  //   });
  //   io.to(receiver?.socket_id).emit("request_accepted", {
  //     message: "Friend Request Accepted",
  //   });
  // });

  // socket.on("get_direct_conversations", async ({ user_id }, callback) => {
  //   const existing_conversations = await OneToOneMessage.find({
  //     participants: { $all: [user_id] },
  //   }).populate("participants", "firstName lastName avatar _id email status");

  //   // db.books.find({ authors: { $elemMatch: { name: "John Smith" } } })

  //   console.log(existing_conversations);

  //   callback(existing_conversations);
  // });

  socket.on("get_direct_conversations", async ({user_id},callback)=>{
    const existing_conversations = await OneToOneMessage.find({
      participants : {$all : [user_id]},
      // 직접 채팅에 참여하는 모든 레코드 검색
    }).populate("participants","firstName lastName _id email status");

    console.log(existing_conversations,"겟 다이렉트 컨버세이션")

    callback(existing_conversations);
  })



  // socket.on("start_conversation", async (data) => {
  //   // data: {to: from:}

  //   const { to, from } = data;

  //   // check if there is any existing conversation

  //   const existing_conversations = await OneToOneMessage.find({
  //     participants: { $size: 2, $all: [to, from] },
  //   }).populate("participants", "firstName lastName _id email status");

  //   console.log(existing_conversations[0], "Existing Conversation");

  //   // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
  //   if (existing_conversations.length === 0) {
  //     let new_chat = await OneToOneMessage.create({
  //       participants: [to, from],
  //     });

  //     new_chat = await OneToOneMessage.findById(new_chat).populate(
  //       "participants",
  //       "firstName lastName _id email status"
  //     );

  //     console.log(new_chat);

  //     socket.emit("start_chat", new_chat);
  //   }
  //   // if yes => just emit event "start_chat" & send conversation details as payload
  //   else {
  //     socket.emit("start_chat", existing_conversations[0]);
  //   }
  // });

  socket.on("start_conversation", async (data) => {
    // data: {to, from}
    const {to, from} = data;
    // check if there is any existing conversation between these users
    const existing_conversations = await OneToOneMessage.find({
      participants: {$size : 2, $all : [to, from]},
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations[0],"Existing Coversation");

    // if no existing_conversation
    if(existing_conversations.length === 0){
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      })

      new_chat = await OneToOneMessage.findById(new_chat.id).populate("participants","firstName lastName _id email status")

      console.log(new_chat);
      socket.emit("start_chat",new_chat);
    }

    // if there is existing _conversation
    else {
      socket.emit("start_chat", existing_conversations[0]);
    }
  })



  socket.on("get_messages", async (data, callback) => {
    try {
      const { messages } = await OneToOneMessage.findById(
        data.conversation_id
      ).select("messages");
      callback(messages);
    } catch (error) {
      console.log(error);
    }
  });

  // Handle incoming text/link messages
  socket.on("text_message", async (data) => {
    console.log("Received message:", data);

    // data: {to, from, text}

    const { message, conversation_id, from, to, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    // message => {to, from, type, created_at, text, file}

    const new_message = {
      to: to,
      from: from,
      type: type,
      created_at: Date.now(),
      text: message,
    };

    // fetch OneToOneMessage Doc & push a new message to existing conversation
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message);
    // save to db`
    await chat.save({ new: true, validateModifiedOnly: true });

    // emit incoming_message -> to user

    io.to(to_user?.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });

    // emit outgoing_message -> from user
    io.to(from_user?.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
  });

  // handle Media/Document Message
  socket.on("file_message", (data) => {
    console.log("Received message:", data);

    // data: {to, from, text, file}

    // Get the file extension
    const fileExtension = path.extname(data.file.name);

    // Generate a unique filename
    const filename = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;

    // upload file to AWS s3

    // create a new conversation if its dosent exists yet or add a new message to existing conversation

    // save to db

    // emit incoming_message -> to user

    // emit outgoing_message -> from user
  });

  // -------------- HANDLE AUDIO CALL SOCKET EVENTS ----------------- //

  // handle start_audio_call event
  socket.on("start_audio_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    console.log("to_user", to_user);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle audio_call_not_picked
  socket.on("audio_call_not_picked", async (data) => {
    console.log(data);
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_missed", {
      from,
      to,
    });
  });

  // handle audio_call_accepted
  socket.on("audio_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("audio_call_accepted", {
      from,
      to,
    });
  });

  // handle audio_call_denied
  socket.on("audio_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("audio_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_audio_call
  socket.on("user_is_busy_audio_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_audio_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_audio_call", {
      from,
      to,
    });
  });

  // --------------------- HANDLE VIDEO CALL SOCKET EVENTS ---------------------- //

  // handle start_video_call event
  socket.on("start_video_call", async (data) => {
    const { from, to, roomID } = data;

    console.log(data);

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    console.log("to_user", to_user);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("video_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle video_call_not_picked
  socket.on("video_call_not_picked", async (data) => {
    console.log(data);
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("video_call_missed", {
      from,
      to,
    });
  });

  // handle video_call_accepted
  socket.on("video_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("video_call_accepted", {
      from,
      to,
    });
  });

  // handle video_call_denied
  socket.on("video_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("video_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_video_call
  socket.on("user_is_busy_video_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_video_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_video_call", {
      from,
      to,
    });
  });


  socket.on("get_message2",  async (data,callback)=>{
    // 콜백의 인수로 메시지 목록
    // 어떤 대화에 대해 메시지를 받고 싶은지
    const {messages2} = await OneToOneMessage.findById(data.conversation_id).select("messages");
    callback(messages2);
    // 클라이언트쪽에서 메세지를 받는 이벤트
  })

  //연습용 Handle text/link messages

  socket.on("text_message2", async (data) => {
    console.log("Receive Message",data);

    // data : {to, from, message, conversation_id, type}
    const {to, from, message, conversation_id, type} = data;
    const to_user = await User.findById(to);
    const from_user = await User.findById(from);


    const new_message = {
      to,
      from,
      type,
      text : message,
      created_at : Date.now(),
    }
    // 몽고디비에 정의한 속성들... OneToOne message 
  
    // create a new conversation if it dosen't exist yet or add new message to the messages list
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages2.push(new_message);

    // save to db
    await chat.save({});

    // emit new_message -> to user
    io.to(to_user.socket_id).emit("new_message",{
      conversation_id,
      message : new_message,
    })

    // emit new_message => from_user 
    io.to(from_user.socket_id).emit("new_message",{
      conversation_id,
      message : new_message,
    })
  });



  socket.on("file_message2", (data) => {
    console.log("Received Message", data);


  // data : {to, from, text}

  // get the file extension

  const fileExtension2 = path.extname(data.file.name);

  //generate a unique filename

  const fileName = `${Date.now()}}_${Math.floor(Math.random()*1000)}${fileExtension2}`;
  // upload file to AWS S3

  // create a new conversation if it dosen't exist yet or add new message to the messages list

  // emit incoming_message -> to user

  // emit outgoing_message => from_user 
})


  // -------------- HANDLE SOCKET DISCONNECTION ----------------- //

  socket.on("end", async (data) => {
    // Find user by ID and set status as offline

    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    } 

    // broadcast to all conversation rooms of this user that this user is offline (disconnected)

    console.log("closing connection");
    socket.disconnect(0);
  });
});




process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1); //  Exit Code 1 indicates that a container shut down, either because of an application failure.
  });
});

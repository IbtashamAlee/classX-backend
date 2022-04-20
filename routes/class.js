const express = require("express");
const router = express.Router();
const {nanoid} = require("nanoid/async");

const {PrismaClient} = require(".prisma/client");
const safeAwait = require("../services/safe_await");
const {verifyUser} = require("../middlewares/verifyUser");
const {checkPermission} = require("../services/checkPermission");
const StudentPermissions = require("../permissions/student.json");
const TeacherPermissions = require("../permissions/teacher.json");
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");

const prisma = new PrismaClient();

//Get all classes
router.get('/', verifyUser, verifySystemAdmin, async (req, res) => {
  const [classes, classesErr] = await safeAwait(prisma.class.findMany());
  if (classesErr) return res.status(409).send("unable to fetch classes");
  return res.send(classes);
})

//To add an independent class
router.post('/add-class', verifyUser, async (req, res) => {
  if (!req.body.name) return res.status(409).send('class name not provided')
  const className = req.body.name.trim();

  const [newClass, newClassErr] = await safeAwait(prisma.class.create({
    data: {
      name: className,
      description: req.body.description || '',
      code: await nanoid(),
    }
  }));

  if (newClassErr || !newClass) return res.status(409).send("unable to create class");

  const [teacherRole, teacherRoleErr] = await safeAwait(prisma.role.upsert({
    where: {
      name: 'Teacher_' + newClass.id,
    },
    update: {},
    create: {
      name: 'Teacher_' + newClass.id,
      classId: newClass.id,
    }
  }))
  if (!teacherRole || teacherRoleErr) return res.status(409).send("unable to generate teacher's role");

  const [studentRole, studentRoleErr] = await safeAwait(prisma.role.upsert({
    where: {
      name: 'Student_' + newClass.id,
    },
    update: {},
    create: {
      name: 'Student_' + newClass.id,
      classId: newClass.id,
    }
  }))
  if (!studentRole || studentRoleErr) return res.status(409).send("unable to generate student's role");

  //Generating permission for student role
  for await (const per of StudentPermissions.permissions) {
    const permission = await prisma.permission.upsert({
      where: {
        code: per.code + '_' + newClass.id
      },
      update: {},
      create: {
        name: per.name + '_' + newClass.id,
        code: per.code + '_' + newClass.id,
      },
    })
    const rolePermission = await prisma.rolePermission.create({
      data: {
        permissionId: permission.id,
        roleId: studentRole.id
      }
    })
    console.log({permission, rolePermission})
  }


  //Generating permission for teachers role
  for await (const per of TeacherPermissions.permissions) {
    const permission = await prisma.permission.upsert({
      where: {
        code: per.code + '_' + newClass.id
      },
      update: {},
      create: {
        name: per.name + '_' + newClass.id,
        code: per.code + '_' + newClass.id,
      },
    })
    await prisma.rolePermission.create({
      data: {
        permissionId: permission.id,
        roleId: teacherRole.id
      }
    })
  }
  //assigning Teacher's role to class creator by default
  await prisma.userRole.create({
    data: {
      userId: req.user.id,
      roleId: teacherRole.id
    }
  });
  await prisma.classParticipants.create({
    data: {
      classId: newClass.id,
      userId: req.user.id
    }
  })
  return res.json({message: "explicit permissions generated", newClass});
})

//Add participants in class
router.post('/:id/participants', verifyUser, async (req, res) => {
  const [findClass, findClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (findClassErr) return res.status(409).send("unable to get class. Something went wrong");
  if (!findClass) return res.status(404).send("Class not found");
  const [isPermitted, permissionErr] = await safeAwait(checkPermission(req.user, `17_${req.params.id}`));
  if (permissionErr) return res.status(409).send("unable to fetch user permissions");
  if (!isPermitted) return res.status(403).send("not authorized")
  let participants_err = [];
  let unavailable_users = [];
  let added_participants = [];
  let already_participants = [];
  const teacherRole = await prisma.role.findUnique({
    where: {
      name: 'Teacher_' + req.params.id
    }
  })
  const studentRole = await prisma.role.findUnique({
    where: {
      name: 'Student_' + req.params.id
    }
  })
  //considering payload in req.body.users
  for await (const reqUser of req.body.users) {
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
          email: reqUser.email
        }
      })
    )
    if (!user) {
      unavailable_users.push(reqUser)
      continue;
    }
    if (userErr) {
      participants_err.push(reqUser);
      continue;
    }
    //check already existing participant
    const [existingParticipant] = await safeAwait(await prisma.classParticipants.findUnique({
      where: {
        classId_userId: {
          classId: findClass.id,
          userId: user.id
        }
      }
    }));
    if (existingParticipant) {
      already_participants.push(reqUser);
      continue;
    }
    // update userRole table and class Participants table
    await prisma.classParticipants.upsert({
      where: {
        classId_userId: {
          classId: findClass.id,
          userId: user.id
        }
      },
      create: {
        classId: findClass.id,
        userId: user.id
      },
      update: {}
    });
    await prisma.userRole.upsert({
      where: {
        roleId_userId: {
          userId: user.id,
          roleId: reqUser.role === 'Student' ? studentRole.id : teacherRole.id
        }
      },
      create: {
        userId: user.id,
        roleId: reqUser.role === 'Student' ? studentRole.id : teacherRole.id
      },
      update: {}
    });
    added_participants.push(reqUser);
  }
  return res.send({participants_err, unavailable_users, already_participants, added_participants});
})

//Get class participants
router.get('/:id/participants', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '43_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [existingClass, existingClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (existingClassErr || !existingClass) return res.status(409).send("unable to find specified class")

  let [participants, participantsErr] = await safeAwait(prisma.role.findMany({
    where: {
      classId: parseInt(req.params.id),
    },
    select: {
      name: true,
      userRole: {
        select: {
          user: {
            select: {
              id: true, name: true, userStatus: true, imageURL: true
            }
          }
        }
      }
    }
  }))
  if (participantsErr) return res.send("unable to fetch participants");
  if (existingClass.departmentId) {
    const [departmentAdmin, departmentAdminErr] = await safeAwait(prisma.role.findMany({
      where: {
        departmentId: existingClass.departmentId,
        classId: null
      },
      select: {
        name: true,
        userRole: {
          select: {
            user: {
              select: {
                id: true, name: true, userStatus: true, imageURL: true
              }
            }
          }
        }
      }
    }))
    if (!departmentAdminErr && departmentAdmin)
      participants = departmentAdmin.concat(participants)
  }
  res.send(participants.map(p => {
    const {name, userRole} = p
    const users = userRole.map(usr => usr.user);
    return {name, users}
  }))
})

/*
* POLLS
* */

//Add poll in class
router.post('/:id/poll', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '22_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  if (req.body.pollOptions.length < 2) return res.status(409).send("minimum 2 options required");
  if (!req.body.statment) return res.status(409).send("No statement provided");
  const [poll, pollErr] = await safeAwait(prisma.classPoll.create({
    data: {
      createdBy: req.user.id,
      startingTime: req.body.startingTime ?? new Date(),
      endingTime: req.body.endingTime ?? new Date(new Date().getTime() + 60 * 60 * 24 * 1000),
      statment: req.body.statment,
      classId: parseInt(req.params.id)
    }
  }));
  console.log(pollErr)
  if (pollErr) return res.status(409).send("unable to add poll");
  for await (const option of req.body.pollOptions) {
    const opt = await prisma.pollOption.create({
      data: {
        pollId: poll.id,
        option: option,
        votes: 0,
      }
    })
  }
  return res.send({poll, pollOption: req.body.pollOptions})
})

//Get all polls in class
router.get('/:id/poll', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '40_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findMany({
    where: {
      classId: parseInt(req.params.id)
    },
    include: {
      pollOptions: true,
      pollComments: {
        where: {
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageURL: true,
            }
          }
        }
      }
    }
  }))
  console.log(pollErr)
  if (pollErr) return res.status(409).send("unable to fetch Poll");
  return res.send(poll)
})

//Get specific poll
router.get('/poll/:pollId', verifyUser, async (req, res) => {
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findUnique({
    where: {
      id: parseInt(req.params.pollId)
    },
    include: {
      pollOptions: true,
      pollComments: {
        where: {
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageURL: true,
            }
          }

        }
      }
    }
  }))
  if (pollErr) return res.status(409).send("unable to fetch Poll");
  const isPermitted = await checkPermission(req.user, '40_' + poll.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  return res.send(poll)
})

//casting a vote in poll
router.post('/poll/:id/vote', verifyUser, async (req, res) => {
  //check if option is provided
  if (!req.body.selectedOptionId) return res.status(409).send("Option not Provided");
  //fetch requested poll
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      pollOptions: {
        where: {
          id: req.body.selectedOptionId
        }
      },
      pollOptionSelection: {
        where: {
          userId: req.user.id
        }
      },
    }
  }))
  //throw err if poll doesn't exist
  if (!poll || pollErr) return res.send("Unable to fetch poll or poll does not exist");
  //check if ending time os overed
  if (new Date() - poll.endingTime > 0) return res.status(409).send("unable to vote. Voting time passed")
  //check whether requested option is valid
  if (poll.pollOptions.length < 1) return res.status(409).send("invalid option");
  if (poll.pollOptionSelection.length > 0) return res.status(409).send("already participated")
  //check user permission to participate in poll
  const isPermitted = await checkPermission(req.user, '32_' + poll.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  //check if user has already participated

  const [, pollSelectionErr] = await safeAwait(prisma.pollOptionSelection.create({
    data: {
      userId: req.user.id,
      pollOptionId: req.body.selectedOptionId,
      pollId: parseInt(req.params.id)
    }
  }))
  if (pollSelectionErr) return res.status(409).send("unable to add option");
  //increment counter by 1
  const [, pollOptionErr] = await safeAwait(prisma.pollOption.update({
    where: {
      id: req.body.selectedOptionId
    },
    data: {
      votes: {increment: 1}
    }
  }))
  if (pollOptionErr) return res.status(409).send("unable to cast vote");
  return res.send("vote casted successfully")
})

//comment on a poll
router.post('/poll/:id/comment', verifyUser, async (req, res) => {
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!poll || pollErr) return res.status(409).send("unable to fetch poll . Poll may not exist")
  //check if ending time os overed
  if (new Date() - poll.endingTime > 0) return res.status(409).send("unable to vote. Voting time passed")
  const isPermitted = await checkPermission(req.user, '34_' + poll.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  const comment = req.body.comment;
  if (!comment) return res.status(409).send("Comment not provided");
  if (comment.trim().length < 1) return res.status(409).send("Empty comments not allowed");
  const [pollComment, pollCommentErr] = await safeAwait(prisma.pollComments.create({
    data: {
      pollId: parseInt(req.params.id),
      userId: req.user.id,
      createdAt: new Date(),
      body: comment.trim()
    }
  }))
  if (pollCommentErr) return res.status(409).send("unable to post comment");
  return res.send({pollComment, message: "comment added successfully"})
})

//delete poll comment
router.put('/poll/comment/:id', verifyUser, async (req, res) => {
  const [comment, commentErr] = await safeAwait(prisma.pollComments.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      poll: true
    }
  }))
  if (commentErr || !comment) return res.status(409).send("Comment not found");
  const isPermitted = await checkPermission(req.user, '35_' + comment.poll.classId);
  if (comment.userId !== req.user.id || !isPermitted) return res.status(403).send("unauthorized");
  const [updatedComment, updatedCommentErr] = await safeAwait(prisma.pollComments.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updatedCommentErr) return res.status(409).send("unable to delete comment");
  return res.send("comment deleted successfully");
})

/*
* ATTENDANCE
* */

//add attendance in class
router.post('/:class/attendance', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '25_' + req.params.class);
  if (!isPermitted) return res.status(403).send("not authorized")
  if (!req.body.title) return res.status(409).send("Attendance Title not provided");
  const [attendance, attendanceErr] = await safeAwait(prisma.classAttendance.create({
    data: {
      classId: parseInt(req.params.class),
      title: req.body.title,
      createdBy: req.user.id,
      createdAt: new Date(),
      startingTime: req.body.startingTime ?? new Date(),
      endingTime: req.body.endingTime ?? new Date(new Date().getTime() + 60 * 60 * 24 * 1000)
    }
  }))
  console.log(attendanceErr)
  if (attendanceErr) return res.status(409).send("Unable to add attendance");
  return res.send(attendance);
})

//get all attendances in class
router.get('/:class/attendance', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '45_' + req.params.class);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [attendance, attendanceErr] = await safeAwait(prisma.classAttendance.findMany({
    where: {
      classId: parseInt(req.params.class)
    },
    include: {
      attendanceRecord: {
        include: {
          userSession: {
            select: {
              createdAt: false, ipv4Address: true, ipv6Address: true, device_model: true,
              browser_version: true, browser_family: true, os_family: true, os_version: true,
            }
          }
        }
      }
    }
  }))
  if (attendanceErr) return res.status(409).send("unable to fetch attendance");
  return res.send(attendance);
})

//get specific attendance in class
router.get('/attendance/:id', verifyUser, async (req, res) => {
  const [attendance, attendanceErr] = await safeAwait(prisma.classAttendance.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      attendanceRecord: {
        include: {
          userSession: {
            select: {
              createdAt: false, ipv4Address: true, ipv6Address: true, device_model: true,
              browser_version: true, browser_family: true, os_family: true, os_version: true,
            }
          }
        }
      }
    }
  }))
  if (!attendance) return res.status(404).send("attendance not found");
  if (attendanceErr) return res.status(409).send("unable to fetch attendance");
  const isPermitted = await checkPermission(req.user, '45_' + attendance.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  return res.send(attendance);
})

//attendance participation
router.post('/:class/attendance/:id', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '39_' + req.params.class);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [attendanceRecord] = await safeAwait(prisma.attendanceRecord.findUnique({
    where: {
      userId_classAttendanceId: {
        userId: req.user.id,
        classAttendanceId: parseInt(req.params.id)
      }
    }
  }))
  if (attendanceRecord) return res.status(409).send("attendance already marked");
  const [newAttendanceRecord, newAttendanceRecordErr] = await safeAwait(prisma.attendanceRecord.create({
    data: {
      classAttendanceId: parseInt(req.params.id),
      userId: req.user.id,
      isPresent: true,
      userSessionId: req.session
    }
  }))
  if (newAttendanceRecordErr) return res.status(409).send("unable to mark attendance");
  return res.send(newAttendanceRecord)
})

/*
* CLASS POSTS
* */

//add post in class
router.post('/:class/post', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '19_' + req.params.class);
  if (!isPermitted) return res.status(403).send("not authorized")
  if (!req.body.content) return res.status(409).send("Post Content not provided");
  // return res.send(files)
  const [post, postErr] = await safeAwait(prisma.classPost.create({
    data: {
      classId: parseInt(req.params.class),
      title: req.body.title,
      createdBy: req.user.id,
      createdAt: new Date(),
      startingTime: req.body.startingTime ?? new Date(),
      body: req.body.content,
    }
  }))
  if (postErr) return res.status(409).send("Unable to add post");
  if (req.body.files) {
    success = []
    failed = []
    for await (file of req.body.files) {
      const [postAttachment, postAttachmentErr] = await safeAwait(prisma.postAttachments.create({
        data: {
          postId: post.id,
          fileId: file.id
        }
      }))
      if (postAttachment) success.push(file)
      if (postAttachmentErr) failed.push(file)
    }
    return res.send({post, files: success, failed_files: failed});
  }
  return res.send({post});

})

//fetch all posts in class
router.get('/:id/post', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '41_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [posts, postsErr] = await safeAwait(prisma.classPost.findMany({
    where: {
      classId: parseInt(req.params.id)
    },
    include: {
      postAttachments: {
        select: {
          file: true
        }
      },
      postComments: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          body: true,
          user: {
            select: {
              id: true, name: true, imageURL: true
            }
          }
        }
      }
    }
  }))
  if (postsErr) return res.status(409).send("Unable to fetch posts")
  return res.json(posts)
})

//fetch particular post in class
router.get('/post/:id', verifyUser, async (req, res) => {
  const [post, postErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      postAttachments: {
        select: {
          file: true
        }
      },
      postComments: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: {
              id: true, name: true, imageURL: true
            }
          },
          body: true
        }
      }
    }
  }))
  if (postErr) return res.status(409).send("Unable to fetch post");
  const isPermitted = await checkPermission(req.user, '41_' + post.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  return res.json(post)
})

//comment on a poll
router.post('/post/:id/comment', verifyUser, async (req, res) => {
  const [post, postErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!post || postErr) return res.status(409).send("unable to fetch post . Post may not exist")
  //check if ending time os overed
  const isPermitted = await checkPermission(req.user, '34_' + post.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  const comment = req.body.comment;
  if (!comment) return res.status(409).send("Comment not provided");
  if (comment.trim().length < 1) return res.status(409).send("Empty comments not allowed");
  const [postComment, postCommentErr] = await safeAwait(prisma.postComments.create({
    data: {
      postId: parseInt(req.params.id),
      userId: req.user.id,
      createdAt: new Date(),
      body: comment.trim()
    }
  }))
  console.log(postCommentErr)
  if (postCommentErr) return res.status(409).send("unable to post comment");
  return res.send({postComment, message: "comment added successfully"})
})

//delete post comments
router.put('/post/comment/:id', verifyUser, async (req, res) => {
  const [comment, commentErr] = await safeAwait(prisma.postComments.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      post: true
    }
  }))
  if (commentErr || !comment) return res.status(409).send("Comment not found");
  const isPermitted = await checkPermission(req.user, '35_' + comment.post.classId);
  if (comment.userId !== req.user.id || !isPermitted) return res.status(403).send("unauthorized");
  const [updatedComment, updatedCommentErr] = await safeAwait(prisma.postComments.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updatedCommentErr) return res.status(409).send("unable to delete comment");
  return res.send("comment deleted successfully");
})


/*
* Class Assessments
* */
//get all class assessments
router.get('/:classid/assessment' , verifyUser , async(req, res)=>{
  const [classAssessment,classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where:{
      classId : parseInt(req.params.classid)
    },
    include:{
      assessmentComments:{
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: {
              id: true, name: true, imageURL: true
            }
          },
          body: true
        }
      }
    }
  }));
  console.log(classAssessmentErr)
  if(classAssessmentErr) return res.status(409).send("unable to fetch class assessments");
  return res.send(classAssessment)
})

//get specific class assessment
router.get('/:classid/assessment/:id' , verifyUser , async(req, res)=>{
  const [classAssessment,classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where:{
      id : parseInt(req.params.id),
      classId : parseInt(req.params.classid)
    }
  }));
  if(classAssessmentErr) return res.status(409).send("unable to fetch class assessments");
  return res.send(classAssessment)
})

//assign an assessment in class
router.post('/:classid/assessment/:id' , verifyUser , async (req,res)=>{
  const [assessment,assessmentErr] = await safeAwait(prisma.assessment.findUnique({
    where:{
      id : parseInt(req.params.id)
    }
  }))
  if(!assessment || assessmentErr) return res.status(409).send("unable to find specified assessment");
  if(assessment.createdBy !== req.user.id || !assessment.isPublic) return res.status(403).send("unauthorized");
  const isPermitted = await checkPermission(req.user, '28_' + req.params.classid);
  console.log(isPermitted)
  if (!isPermitted) return res.status(403).send("not authorized");
  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.create({
    data:{
      classId : parseInt(req.params.classid),
      assessmentId : assessment.id,
      allowResubmission : req.body.allowResubmission ?? false,
      startingTime : req.body.startingTime ?? new Date(),
      isMultiTimer : req.body.isMultiTimer ?? false,
      QuestionsToDisplay : req.body.questionsToDisplay ?? null
    }
  }))
  if(classAssessmentErr) return res.status(409).send("unable to add assessment to class");
  return res.send(classAssessment);
})

//comment on class assessment
router.post('/assessment/:id/comment', verifyUser, async (req, res) => {
  const [classAssessment, classAssesssmentErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!classAssessment || classAssesssmentErr) return res.status(409).send("unable to find specified class assessment");
  const isPermitted = await checkPermission(req.user, '34_' + classAssessment.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  const comment = req.body.comment;
  if (!comment) return res.status(409).send("Comment not provided");
  if (comment.trim().length < 1) return res.status(409).send("Empty comments not allowed");
  const [classAssessmentComment,classAssessmentCommentErr] = await safeAwait(prisma.classAssessmentComments.create({
    data: {
      assessmentId: parseInt(req.params.id),
      userId: req.user.id,
      createdAt: new Date(),
      body: comment.trim()
    }
  }))
  console.log(classAssessmentCommentErr)
  if (classAssessmentCommentErr) return res.status(409).send("unable to post comment");
  return res.send({classAssessmentComment, message: "comment added successfully"})
})

//delete class assessment comments
router.put('/assessment/comment/:id', verifyUser, async (req, res) => {
  const [comment, commentErr] = await safeAwait(prisma.classAssessmentComments.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      classAssessment: true
    }
  }))
  if (commentErr || !comment) return res.status(409).send("Comment not found");
  const isPermitted = await checkPermission(req.user, '35_' + comment.classAssessment.classId);
  if (comment.userId !== req.user.id || !isPermitted) return res.status(403).send("unauthorized");
  const [updatedComment, updatedCommentErr] = await safeAwait(prisma.classAssessmentComments.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updatedCommentErr) return res.status(409).send("unable to delete comment");
  return res.send("comment deleted successfully");
})


module.exports = router;
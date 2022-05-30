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
      createdBy: parseInt(req.user.id),
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
  if (findClass.deletedAt !== null) return res.status(409).send("class doesn't exist");
  const [isPermitted, permissionErr] = await safeAwait(checkPermission(req.user, `17_${req.params.id}`));
  if (permissionErr) return res.status(409).send("unable to fetch user permissions");
  if (!isPermitted) return res.status(403).send("not authorized");
  if (!req.body.users) return res.status(409).send("users not provided");
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

//Remove participants from class
router.post('/:id/participants/remove', verifyUser, async (req, res) => {
  const [findClass, findClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (findClassErr) return res.status(409).send("unable to get class. Something went wrong");
  if (!findClass) return res.status(404).send("Class not found");
  if (findClass.deletedAt !== null) return res.status(409).send("class doesn't exist");
  const [isPermitted, permissionErr] = await safeAwait(checkPermission(req.user, `18_${req.params.id}`));
  if (permissionErr) return res.status(409).send("unable to fetch user permissions");
  if (!isPermitted) return res.status(403).send("not authorized");
  if (!req.body.users) return res.status(409).send("users not provided");
  let err_removing = [];
  let unavailable_users = [];
  let removed_participants = [];
  let not_participants = [];
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
      unavailable_users.push(reqUser.email)
      continue;
    }
    if (userErr) {
      err_removing.push(reqUser.email);
      continue;
    }
    if (findClass.createdBy === user.id) {
      err_removing.push(reqUser.email);
      continue;
    }
    //check already existing participant
    const [existingParticipant, ERR] = await safeAwait(await prisma.classParticipants.findUnique({
      where: {
        classId_userId: {
          classId: findClass.id,
          userId: user.id
        }
      }
    }));
    console.log(existingParticipant)
    if (!existingParticipant) {
      not_participants.push(reqUser.email);
      continue;
    }

    // update userRole table and class Participants table
    await safeAwait(prisma.classParticipants.delete({
      where: {
        classId_userId: {
          classId: findClass.id,
          userId: user.id
        }
      }
    }))

    await safeAwait(prisma.userRole.delete({
      where: {
        roleId_userId: {
          userId: user.id,
          roleId: reqUser.role === 'Teacher' ? teacherRole.id : studentRole.id
        }
      }
    }))

    removed_participants.push(reqUser.email);
  }
  return res.send({err_removing, not_participants, unavailable_users, removed_participants});
})

//Join class using code
router.post('/join/:code', verifyUser, async (req, res) => {
  const [findClass, findClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      code: req.params.code
    }
  }))
  if (findClassErr) return res.status(409).send("unable to get class. Something went wrong");
  if (!findClass) return res.status(404).send("Class not found");
  if (findClass.deletedAt !== null) return res.status(409).send("class doesn't exist");
  const studentRole = await prisma.role.findUnique({
    where: {
      name: 'Student_' + findClass.id
    }
  })

  const [user, userErr] = await safeAwait(prisma.user.findUnique({
      where: {
        email: req.user.email
      }
    })
  )
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
    return res.send("Already a participant of this class");
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
        roleId: studentRole.id
      }
    },
    create: {
      userId: user.id,
      roleId: studentRole.id
    },
    update: {}
  });
  return res.send("successfully added to the class.")
})

//Get class participants
router.get('/:id/participants', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '43_' + req.params.id);
  console.log(isPermitted)
  if (!isPermitted) return res.status(403).send("not authorized")
  const [existingClass, existingClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (existingClassErr || !existingClass) return res.status(409).send("unable to find specified class")
  if (existingClass.deletedAt !== null) return res.status(409).send("class doesn't exist");

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
              id: true, email: true, name: true, userStatus: true, imageUrl: true
            }
          }
        }
      }
    }
  }))
  console.log(participantsErr)
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
                id: true, name: true, userStatus: true, imageUrl: true
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

//Delete a class
router.put('/:id/delete', verifyUser, async (req, res) => {
  const [existingClass, existingClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!existingClass || existingClassErr) return res.status(404).send("unable to find class")
  if (existingClass.createdBy !== req.user.id) return res.status(403).send("unauthorized. Only class owner can delete class");
  if (existingClass.deletedAt !== null) return res.status(409).send("class already deleted");
  const [updatedClass, updatedClassErr] = await safeAwait(prisma.class.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (!updatedClass || updatedClassErr) return res.status(409).send("unable to delete class");
  return res.send("class deleted successfully");
})

//Get deleted class
router.get('/deleted/', verifyUser, async (req, res) => {
  const [deletedClasses, deletedClassesErr] = await safeAwait(prisma.class.findMany({
    where: {
      createdBy: req.user.id,
      NOT: {
        deletedAt: null
      }
    }
  }))
  if (deletedClassesErr) return res.status(409).send("unable to fetch deleted classes");
  return res.send(deletedClasses)
})

//restore a deleted class
router.put('/:id/restore', verifyUser, async (req, res) => {
  const [existingClass, existingClassErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!existingClass || existingClassErr) return res.status(404).send("unable to find class")
  if (existingClass.createdBy !== req.user.id) return res.status(403).send("unauthorized. Only class owner can delete class");
  if (existingClass.deletedAt === null) return res.status(409).send("class is not deleted");
  const [updatedClass, updatedClassErr] = await safeAwait(prisma.class.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: null
    }
  }))
  if (!updatedClass || updatedClassErr) return res.status(409).send("unable to restore");
  return res.send("class restored successfully");
})

//add/update class profile pic
router.put("/:id/profile-pic", verifyUser, async (req, res) => {
  if (!req.body.imageUrl) return res.status(409).send("url not provided");
  const [updatedClass] = await safeAwait(prisma.class.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      imageUrl: req.body.imageUrl
    }
  }))
  console.log(updatedClass)
  if (updatedClass) return res.send("class image updated successfully")
  return res.send("unable to update class image");
})

/*
* POLLS
* */

//Add poll in class
router.post('/:id/poll', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '22_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  if (req.body.pollOptions.length < 2) return res.status(409).send("minimum 2 options required");
  if (!req.body.statement) return res.status(409).send("No statement provided");
  const [poll, pollErr] = await safeAwait(prisma.classPoll.create({
    data: {
      createdBy: req.user.id,
      startingTime: req.body.startingTime ?? new Date(),
      endingTime: req.body.endingTime ?? new Date(new Date().getTime() + 60 * 60 * 24 * 1000),
      statement: req.body.statement,
      classId: parseInt(req.params.id)
    }
  }));
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

//delete a poll
router.put('/poll/:id', verifyUser, async (req, res) => {
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }));
  if (pollErr || !poll) return res.status(409).send("unable to find poll");
  const isPermitted = await checkPermission(req.user, '24_' + poll.classId);
  if (!isPermitted) return res.status(403).send("not authorized");
  if (poll.deletedAt !== null) return res.status(409).send("poll deleted already");
  console.log(poll.deletedAt)
  const [updatedPoll, updatedPollErr] = await safeAwait(prisma.classPoll.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }));
  if (updatedPollErr) return res.status(409).send("unable to delete poll");
  return res.send("poll deleted successfully");
})

//Get all polls in class
router.get('/:id/poll', verifyUser, async (req, res) => {
  const records = req.query.records
  const page = req.query.page
  const isPermitted = await checkPermission(req.user, '40_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  let [poll, pollErr] = await safeAwait(prisma.classPoll.findMany({
    where: {
      classId: parseInt(req.params.id),
      deletedAt: null
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
              imageUrl: true,
            }
          }
        }
      },
      pollOptionSelection: {
        select: {
          userId: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  if (pollErr) return res.status(409).send("unable to fetch Poll");

  poll = poll.map(p => {
    return {...p, pollOptionSelection: p.pollOptionSelection.map(opt => opt.userId)}
  })
  poll = poll.map(p => {
    totalVotes = 0
    hasParticipated = (p.pollOptionSelection.includes(req.user.id))
    p.pollOptions.map(opt => {
      totalVotes += parseInt(opt.votes)
    })
    return {...p, totalVotes, hasParticipated: hasParticipated}
  })
  return res.send(poll)
})

//Get specific poll
router.get('/poll/:pollId', verifyUser, async (req, res) => {
  const [poll, pollErr] = await safeAwait(prisma.classPoll.findMany({
    where: {
      id: parseInt(req.params.pollId),
      deletedAt: null
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
              imageUrl: true,
            }
          }
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    }
  }))
  if (poll.length < 1) return res.status(404).send("poll not found");
  if (pollErr) return res.status(409).send("unable to fetch Poll");
  const isPermitted = await checkPermission(req.user, '40_' + poll[0].classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  totalVotes = 0;
  poll[0].pollOptions.map(opt => {
    totalVotes += opt.votes
  })
  const [pollOptionSelection] = await safeAwait(prisma.pollOptionSelection.findUnique({
    where: {
      userId_pollId: {
        userId: req.user.id,
        pollId: poll[0].id
      }
    }
  }))
  return pollOptionSelection ? res.send({...poll[0], totalVotes, hasParticipated: true}) :
    res.send({...poll[0], totalVotes, hasParticipated: false})
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
  if (poll.deletedAt !== null) return res.send("The requested poll doesn't exist");
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
  if (poll.deletedAt !== null) return res.send("The requested poll doesn't exist");
  //check if ending time is over
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
  if (attendanceErr) return res.status(409).send("Unable to add attendance");
  return res.send(attendance);
})

//get all attendances in class
router.get('/:class/attendance', verifyUser, async (req, res) => {
  const records = req.query.records
  const page = req.query.page
  const isPermitted = await checkPermission(req.user, '45_' + req.params.class);
  if (!isPermitted) return res.status(403).send("not authorized")
  let [attendance, attendanceErr] = await safeAwait(prisma.classAttendance.findMany({
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
          },
          user: {
            select: {
              id: true, name: true, email: true, userStatus: true, imageUrl: true
            }
          }
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  let isPresent = [];
  attendance.map(a => {
    a.attendanceRecord.map(record => {
      if (record.userId === req.user.id) {
        isPresent.push(a.id)
      }
    })
  })
  attendance = attendance.map(a => {
    return isPresent.includes(a.id) ? {...a, isPresent: true} : {...a, isPresent: false}
  });
  if (attendanceErr) return res.status(409).send("unable to fetch attendance");
  return res.send(attendance);
})

//get specific attendance in class
router.get('/attendance/:id', verifyUser, async (req, res) => {
  let [attendance, attendanceErr] = await safeAwait(prisma.classAttendance.findUnique({
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
          },
          user: {
            select: {
              id: true, name: true, email: true, userStatus: true, imageUrl: true
            }
          }
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    }
  }))
  if (!attendance) return res.status(404).send("attendance not found");
  if (attendanceErr) return res.status(409).send("unable to fetch attendance");
  const isPermitted = await checkPermission(req.user, '45_' + attendance.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  let isPresent = false;
  attendance.attendanceRecord.map(record => {
    if (record.userId === req.user.id) {
      isPresent = true
    }
  })
  attendance = {...attendance, isPresent}
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

//delete class post
router.put('/post/:id', verifyUser, async (req, res) => {
  const [post, postErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (postErr || !post) return res.status(409).send("post not found");
  if (post.createdBy !== req.user.id) return res.status(403).send("unauthorized");
  if (post.deletedAt !== null) return res.status(409).send("post already deleted");
  const [updatedPost, updatedPostErr] = await safeAwait(prisma.classPost.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updatedPostErr) return res.status(409).send("unable to delete class Post");
  return res.send("post deleted sucessfully");
})

//fetch all posts in class
router.get('/:id/post', verifyUser, async (req, res) => {
  const records = req.query.records
  const page = req.query.page

  const isPermitted = await checkPermission(req.user, '41_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized")
  const [posts, postsErr] = await safeAwait(prisma.classPost.findMany({
    where: {
      classId: parseInt(req.params.id),
      deletedAt: null
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
              id: true, name: true, imageUrl: true
            }
          }
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  if (postsErr) return res.status(409).send("Unable to fetch posts")
  return res.json(posts)
})

//fetch particular post in class
router.get('/post/:id', verifyUser, async (req, res) => {
  const [post, postErr] = await safeAwait(prisma.classPost.findMany({
    where: {
      id: parseInt(req.params.id),
      deletedAt: null
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
              id: true, name: true, imageUrl: true
            }
          },
          body: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    }
  }))
  if (postErr) return res.status(409).send("Unable to fetch post");
  if (post.length < 1) return res.status(404).send("not found")
  const isPermitted = await checkPermission(req.user, '41_' + post[0].classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  return res.json(post[0])
})

//comment on a post
router.post('/post/:id/comment', verifyUser, async (req, res) => {
  const [post, postErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))

  if (!post || postErr) return res.status(409).send("unable to fetch post . Post may not exist")
  if (post.deletedAt !== null) return res.status(404).send("post not found");
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
  if (comment.deletedAt !== null) return res.status(409).send("already deleted");
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

//---------------------------------------------------------
/*
* Class Assessments
* */

//get all class assessments
router.get('/:classid/assessment', verifyUser, async (req, res) => {
  const records = req.query.records
  const page = req.query.page

  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      classId: parseInt(req.params.classid),
      deletedAt: null
    },
    include: {
      assessmentComments: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: {
              id: true, name: true, imageUrl: true
            }
          },
          body: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }));
  if (classAssessmentErr) return res.status(409).send("unable to fetch class assessments");
  return res.send(classAssessment)
})

//get specific class assessment
router.get('/assessment/:id', verifyUser, async (req, res) => {
  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      id: parseInt(req.params.id),
      deletedAt: null
    },
    include: {
      assessment: {
        include: {
          question: {
            include: {
              option: true
            }
          }

        },
      },
      assessmentComments: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: {
              id: true, name: true, imageUrl: true
            }
          },
          body: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    }
  }));
  if (!classAssessment[0] || classAssessmentErr) return res.status(409).send("unable to fetch class assessments");
  const totalQuestions = classAssessment[0].assessment.question.length
  const toDisplay = classAssessment[0].QuestionsToDisplay
  const rand_arr = []
  const questions = classAssessment[0].assessment.question
  const shortListed = []
  if (toDisplay < totalQuestions) {
    for (let i = 0; i < totalQuestions; i++) {
      i < toDisplay ? rand_arr.push(true) : rand_arr.push(false)
    }
    rand_arr.sort(() => Math.random() - 0.5)
    for (let i = 0; i < questions.length; i++) {
      if (rand_arr[i]) {
        shortListed.push(questions[i])
      }
    }
    classAssessment[0].assessment.question = shortListed;
  }
  const isPermitted = await checkPermission(req.user, '42_' + classAssessment[0].classId);
  if (!isPermitted) return res.status(403).send("unauthorized");
  return res.send(classAssessment[0] ?? [])
})

//assign an assessment in class
router.post('/:classid/assessment/:id', verifyUser, async (req, res) => {
  const [assessment, assessmentErr] = await safeAwait(prisma.assessment.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!assessment || assessmentErr) return res.status(409).send("unable to find specified assessment");
  if (assessment.createdBy !== req.user.id && !assessment.isPublic) return res.status(403).send("unauthorized");
  if (assessment.deletedAt !== null) return res.status(404).send("assessment not found");
  const isPermitted = await checkPermission(req.user, '28_' + req.params.classid);
  if (!isPermitted) return res.status(403).send("not authorized");
  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.create({
    data: {
      classId: parseInt(req.params.classid),
      assessmentId: assessment.id,
      allowResubmission: req.body.allowResubmission ?? false,
      startingTime: req.body.startingTime ?? new Date(),
      endingTime: req.body.endingTime ?? new Date(new Date().getTime() + 60 * 60 * 24 * 1000),
      isMultiTimer: req.body.isMultiTimer ?? false,
      QuestionsToDisplay: req.body.questionsToDisplay ?? null,
      createdBy: req.user.id
    }
  }))
  if (classAssessmentErr) return res.status(409).send("unable to add assessment to class");
  return res.send(classAssessment);
})

//delete an assessment from class
router.put('/assessment/:id', verifyUser, async (req, res) => {
  const [assessment, assessmentErr] = await safeAwait(prisma.classAssessment.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (assessmentErr || !assessment) return res.status(409).send("assessment not found");
  if (assessment.createdBy !== req.user.id) return res.status(403).send("unauthorized");
  if (assessment.deletedAt !== null) return res.status(409).send("assessment already deleted");
  const [updatedAssessment, updatedAssessmentErr] = await safeAwait(prisma.classAssessment.update({
    where: {
      id: parseInt(req.params.id)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updatedAssessmentErr) return res.status(409).send("unable to delete class Assessment");
  return res.send("assessment deleted successfully");
})

//comment on class assessment
router.post('/assessment/:id/comment', verifyUser, async (req, res) => {
  const [classAssessment, classAssesssmentErr] = await safeAwait(prisma.classPost.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (classAssessment.deletedAt !== null) return res.status(404).send("assessment not found");
  if (!classAssessment || classAssesssmentErr) return res.status(409).send("unable to find specified class assessment");
  const isPermitted = await checkPermission(req.user, '34_' + classAssessment.classId);
  if (!isPermitted) return res.status(403).send("not authorized")
  const comment = req.body.comment;
  if (!comment) return res.status(409).send("Comment not provided");
  if (comment.trim().length < 1) return res.status(409).send("Empty comments not allowed");
  const [classAssessmentComment, classAssessmentCommentErr] = await safeAwait(prisma.classAssessmentComments.create({
    data: {
      assessmentId: parseInt(req.params.id),
      userId: req.user.id,
      createdAt: new Date(),
      body: comment.trim()
    }
  }))
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

//Attempt assessments
//add question response in assessment
//calculate question score on run -
router.post('/:classId/assessment/:id/question/:questionId/response', async (req, res) => {
  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      id: parseInt(req.params.id),
      deletedAt: null
    },
    include: {
      assessment: {
        include: {
          question: {
            where: {
              id: parseInt(req.params.questionId)
            }
          }
        }
      }
    }
  }))
  if (!classAssessment || classAssessment.length < 1 || classAssessmentErr) return res.status(404).send("not found");
  console.log(classAssessment)
  if (classAssessment[0].assessment.question[0].id === parseInt(req.params.questionId)) {

  }
})


/*
* Class Feed
* */
router.get('/:classid/feed', verifyUser, async (req, res) => {
  const isPermitted = await checkPermission(req.user, '44_' + req.params.classid);
  if (!isPermitted) return res.status(403).send("unauthorized");
  const records = req.query.records
  const page = req.query.page
  let classFeed = [];
  const [classAssessment, classAssessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      classId: parseInt(req.params.classid)
    },
    include: {
      assessmentComments: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: {
              id: true, name: true, imageUrl: true
            }
          },
          body: true
        }
      },
      assessment: {
        select: {
          name: true,
          body: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }));
  const [posts] = await safeAwait(prisma.classPost.findMany({
    where: {
      classId: parseInt(req.params.classid)
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
              id: true, name: true, imageUrl: true
            }
          }
        }
      }
      ,
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  let [attendance, Err] = await safeAwait(prisma.classAttendance.findMany({
    where: {
      classId: parseInt(req.params.classid)
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
        },
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },
    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  console.log(Err)
  let isPresent = [];
  attendance.map(a => {
    a.attendanceRecord.map(record => {
      if (record.userId === req.user.id) {
        isPresent.push(a.id)
      }
    })
  })
  attendance = attendance.map(a => {
    return isPresent.includes(a.id) ? {...a, isPresent: true} : {...a, isPresent: false}
  });

  let [poll] = await safeAwait(prisma.classPoll.findMany({
    where: {
      classId: parseInt(req.params.classid)
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
              imageUrl: true,
            }
          }
        }
      },
      pollOptionSelection: {
        select: {
          userId: true
        }
      },
      user: {
        select: {
          imageUrl: true, name: true
        }
      }
    },

    ...(page && records && {
      skip: parseInt((page - 1) * records),
      take: parseInt(records)
    })
  }))
  poll = poll.map(p => {
    return {...p, pollOptionSelection: p.pollOptionSelection.map(opt => opt.userId)}
  })
  poll = poll.map(p => {
    totalVotes = 0
    hasParticipated = (p.pollOptionSelection.includes(req.user.id))
    p.pollOptions.map(opt => {
      totalVotes += parseInt(opt.votes)
    })
    return {...p, totalVotes, hasParticipated: hasParticipated}
  })

  if (classAssessment) classFeed = classFeed.concat(classAssessment.map(assessment => ({type: "assessment", ...assessment})));
  if (posts) classFeed = classFeed.concat(posts.map(post => ({type: "post", ...post})));
  if (attendance) classFeed = classFeed.concat(attendance.map(attendance => ({type: "attendance", ...attendance})));
  if (poll) classFeed = classFeed.concat(poll.map(poll => ({type: "poll", ...poll})));
  return res.send(classFeed.sort((x, y) => y.startingTime - x.startingTime));
})


module.exports = router;

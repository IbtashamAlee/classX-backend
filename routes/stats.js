const express = require("express");
const router = express.Router();

const {PrismaClient} = require(".prisma/client");
const safeAwait = require("../services/safe_await");
const {verifyUser} = require("../middlewares/verifyUser");

const prisma = new PrismaClient();

//get numbers of class posts(post, poll, attendance, assessments)
router.get('/class/:classid/general-stats', verifyUser, async (req, res) => {
  let classFeed = {};
  const [classAssessment] = await safeAwait(prisma.classAssessment.aggregate({
    _count: {
      id: true
    },
    where: {
      classId: parseInt(req.params.classid)
    }
  }));
  const [posts] = await safeAwait(prisma.classPost.aggregate({
    _count: {
      id: true
    },
    where: {
      classId: parseInt(req.params.classid)
    }
  }))

  let [attendance, Err] = await safeAwait(prisma.classAttendance.aggregate({
    _count: {
      id: true
    },
    where: {
      classId: parseInt(req.params.classid)
    }
  }))
  console.log(Err)

  let [poll] = await safeAwait(prisma.classPoll.aggregate({
    _count: {
      id: true
    },
    where: {
      classId: parseInt(req.params.classid)
    }
  }))


  if (classAssessment) classFeed = ({...classFeed, assessments: classAssessment._count.id});
  if (posts) classFeed = {...classFeed, posts: posts._count.id};
  if (attendance) classFeed = {...classFeed, attendances: attendance._count.id};
  if (poll) classFeed = {...classFeed, polls: poll._count.id};
  return res.send(classFeed)
})

router.get('/class/:classid/comments-stats',verifyUser, async (req, res)=>{
  let assessment_comments = 0;
  let poll_comments = 0;
  let post_comments = 0;

  const [postComments,postCommentsErr] = await safeAwait(prisma.classPost.findMany({
    where:{
      classId : parseInt(req.params.classid)
    },
    include:{
      postComments : true
    }
  }))
  const [pollComments,pollCommentsErr] = await safeAwait(prisma.classPoll.findMany({
    where:{
      classId : parseInt(req.params.classid)
    },
    include:{
      pollComments : true
    }
  }))
  const [assessmentComments,assessmentCommentsErr] = await safeAwait(prisma.classAssessment.findMany({
    where:{
      classId : parseInt(req.params.classid)
    },
    include:{
      assessmentComments : true
    }
  }))
  if (postComments.length > 0) {
    postComments.map(post => {
        if (post.postComments.length > 0) {
          (post.postComments.map(comment => {
              post_comments++
            })
          )
        }
      }
    )
  }
  if (pollComments.length > 0) {
    pollComments.map(post => {
        if (post.pollComments.length > 0) {
          (post.pollComments.map(comment => {
              poll_comments++
            })
          )
        }
      }
    )
  }

  if (assessmentComments.length > 0) {
    assessmentComments.map(post => {
        if (post.asessmentComments.length > 0) {
          (post.assessmentComments.map(comment => {
              assessment_comments++
            })
          )
        }
      }
    )
  }
  return res.send({post_comments,poll_comments,assessment_comments})
})

//individuals' attendance
router.get('/class/:classid/student/:student/attendance-stats', verifyUser, async (req, res) => {
  let [stdAttendance, stdErr] = await safeAwait(prisma.classAttendance.findMany({
    where: {
      classId: parseInt(req.params.classid)
    },
    include: {
      attendanceRecord: {
        where: {
          userId: parseInt(req.params.student)
        }
      }
    }
  }))
  // return res.send(stdAttendance)
  let total = 0;
  let present = 0;
  if (stdAttendance.length > 0) {
    stdAttendance.map(attendance => {
      total++;
      if (attendance?.attendanceRecord[0]?.isPresent === true) present++
    })
  }
  res.send({total, present})
})

//student Attendance details
router.get('/class/:classid/student/:student/attendance', verifyUser, async (req, res) => {
  let [stdAttendance, stdErr] = await safeAwait(prisma.classAttendance.findMany({
    where: {
      classId: parseInt(req.params.classid)
    },
    include: {
      attendanceRecord: {
        where: {
          userId: parseInt(req.params.student)
        }
      }
    }
  }))
  res.send(stdAttendance)
})

//student Marks details
router.get('/class/:classid/student/:student/marks', verifyUser, async (req, res) => {
  let [assessment, assessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      classId: parseInt(req.params.classid),
      deletedAt: null
    },
    include: {
      assessment: true,
      classAssessmentSubmission: {
        where:{
          userId : parseInt(req.params.student)
        }
      }
    }
  }))
  if (assessmentErr) return res.status(409).send("unable to fetch assessments");
  assessment = assessment.map(a => {
    return a.classAssessmentSubmission.length > 0 ? {...a, isSubmitted: true} : {...a, isSubmitted: false}
  })
  return res.send(assessment)
})

//student Marks stats
router.get('/class/:classid/student/:student/marks-stats', verifyUser, async (req, res) => {
  let [assessment, assessmentErr] = await safeAwait(prisma.classAssessment.findMany({
    where: {
      classId: parseInt(req.params.classid),
      deletedAt: null
    },
    include: {
      classAssessmentSubmission: {
        where:{
          userId : parseInt(req.params.student)
        }
      }
    }
  }))
  if (assessmentErr) return res.status(409).send("unable to fetch assessments");
  let totalMarks = 0;
  let obtainedMarks = 0;
  assessment.map(a => {
    if (a.classAssessmentSubmission.length > 0) {
      totalMarks += a.classAssessmentSubmission[0].totalMarks;
      obtainedMarks += a.classAssessmentSubmission[0].obtainedMarks;
    }
  })
  return res.send({totalMarks, obtainedMarks})
})

//class's aggregated attendance
router.get('/class/:classId/attendance-stats', verifyUser, async (req, res) => {
  const [attendance, attendanceErr] = await safeAwait(prisma.class.findUnique({
    where: {
      id: parseInt(req.params.classId)
    },
    include: {
      classAttendance: {
        include: {
          attendanceRecord: true
        }
      }
    }
  }))
  if (attendanceErr) return res.status(409).send("unable to send");
  let total_attendances = 0;
  let total_presents = 0;
  attendance.classAttendance.map(record => {
    if (record.attendanceRecord.length > 0) {
      record.attendanceRecord.map(attendance => {
        total_attendances++;
        if (attendance.isPresent) total_presents++
      })
    }
  })
  return res.send({total_attendances, total_presents})
})

//department's aggregated attendance
router.get('/department/:dep_id/attendance-stats', verifyUser, async (req, res) => {
  const [attendance, attendanceErr] = await safeAwait(prisma.class.findMany({
    where: {
      departmentId: parseInt(req.params.dep_id)
    },
    include: {
      classAttendance: {
        include: {
          attendanceRecord: true
        }
      }
    }
  }))
  if (attendanceErr) return res.status(409).send("unable to send");
  let total_attendances = 0;
  let total_presents = 0;
  attendance.map(c => {
    if (c.classAttendance.length > 0) {
      c.classAttendance.map(record => {
        if (record.attendanceRecord.length > 0) {
          record.attendanceRecord.map(attendance => {
            total_attendances++;
            if (attendance.isPresent) total_presents++
          })
        }
      })
    }
  })
  return res.send({total:total_attendances,present:total_presents})
})

//Institute's aggregated attendance
router.get('/institute/:ins_id/attendance-stats', verifyUser, async (req, res) => {
  const [attendance, attendanceErr] = await safeAwait(prisma.institute.findUnique({
    where: {
      id: parseInt(req.params.ins_id)
    },
    select: {
      departments:{
        include:{
          class:{
            include: {
              classAttendance: {
                include: {
                  attendanceRecord: true
                }
              }
            }
          }
        }
      }
    }
  }))
  if (attendanceErr) return res.status(409).send("unable to send");
  let total_attendances = 0;
  let total_presents = 0;
  attendance.departments.map(d => {
    if(d.class.length > 0 ){
      d.class.map(c=>{
        if (c.classAttendance.length > 0) {
          c.classAttendance.map(record => {
            if (record.attendanceRecord.length > 0) {
              record.attendanceRecord.map(attendance => {
                total_attendances++;
                if (attendance.isPresent) total_presents++
              })
            }
          })
        }
      })
    }
  })
  return res.send({total:total_attendances, present:total_presents})
})


module.exports = router;

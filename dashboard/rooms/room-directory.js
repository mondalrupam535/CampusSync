(function (root) {
  'use strict';

  var verificationLabels = {
    D: 'Documented location',
    P: 'Proposed placeholder',
    L: 'Facility documented; room ID is a proposed placeholder'
  };
  var rooms = [];

  function addFloor(building, floor, entries, defaultVerification) {
    entries.trim().split(/\r?\n/).forEach(function (line) {
      var fields = line.split('|');
      rooms.push({
        building: building,
        floor: floor,
        code: fields[0],
        facility: fields[1],
        verification: verificationLabels[fields[2]] || defaultVerification
      });
    });
  }

  var cv = 'C.V. Raman Block';
  var sr = 'SR Block';
  var xlab = 'X-Lab';
  var jc = 'J.C. Bose Block';
  var vikram = 'Vikram Sarabhai Block (V Block)';
  var bhabha = 'Homi J. Bhabha Block (HJB)';
  var admin = 'NAB';

  addFloor(cv, 'Basement', `
CV-B-01|Electrical Maintenance Room
CV-B-02|Storage Room
CV-B-03|Teaching Learning Centre / E-Learning Studio
CV-B-04|Network and Server Room
CV-B-05|Housekeeping Room`, 'Proposed placeholder');
  addFloor(cv, 'Ground floor', `
CV-G01|Main Reception
CV-G02|Security Office
CV-G03|Administrative Office
CV-G04|Student Help Desk
CV-G05|Waiting Area
CV-G06|Conference Room
CV-G07|General Classroom
CV-G08|Faculty Meeting Room`, 'Proposed placeholder');
  addFloor(cv, 'First floor', `
CV-101|General Classroom
CV-102|General Classroom
CV-103|Smart Classroom
CV-104|General Classroom
CV-105|Computer Laboratory
CV-106|Faculty Room
CV-107|Discussion Room
CV-108|Department Office`, 'Proposed placeholder');
  addFloor(cv, 'Second floor', `
CV-201|General Classroom
CV-202|Lecture / Event Venue
CV-203|Smart Classroom
CV-204|General Classroom
CV-205|Computer Laboratory
CV-206|Discussion Room
CV-207|Seminar Room
CV-208|Faculty Workspace
CV-209|CSE Faculty Cabin Area
CV-210|CSE Faculty Office Area`, 'Proposed placeholder');
  addFloor(cv, 'Third floor', `
CV-301|General Classroom
CV-302|Tiered Classroom
CV-303|Smart Classroom
CV-304|General Classroom
CV-305|Computer Laboratory
CV-306|Discussion Room
CV-307|ECE Faculty Cabin Area
CV-308|Faculty Workspace
CV-309|Electronics Laboratory
CV-310|Project Laboratory`, 'Proposed placeholder');
  addFloor(cv, 'Fourth floor', `
CV-401|General Classroom
CV-402|Tiered Classroom
CV-403|Smart Classroom
CV-404|General Classroom
CV-405|Computer Laboratory
CV-406|Project Laboratory
CV-407|Seminar Room
CV-408|Faculty Workspace
CV-409|Discussion Room
CV-410|Department Office`, 'Proposed placeholder');
  addFloor(cv, 'Fifth floor', `
CV-501|General Classroom
CV-502|General Classroom
CV-503|Smart Classroom
CV-504|Computer Laboratory
CV-505|Project Laboratory
CV-506|Seminar Room
CV-507|Workshop / Classroom
CV-508|Faculty Workspace
CV-509|Discussion Room
CV-510|Department Office`, 'Proposed placeholder');
  addFloor(cv, 'Sixth floor', `
CV-601|General Classroom
CV-602|General Classroom
CV-603|Smart Classroom
CV-604|Computer Laboratory
CV-605|CSE Faculty Cabin Area
CV-606|Project Laboratory
CV-607|Seminar Room
CV-608|Discussion Room`, 'Proposed placeholder');
  addFloor(cv, 'Seventh floor', `
CV-701|General Classroom
CV-702|General Classroom
CV-703|Smart Classroom
CV-704|Computer Laboratory
CV-705|Research Laboratory
CV-706|Faculty Workspace
CV-707|Project Room
CV-708|Seminar Room`, 'Proposed placeholder');
  addFloor(cv, 'Eighth floor', `
CV-801|General Classroom
CV-802|General Classroom
CV-803|Smart Classroom
CV-804|Computer Laboratory
CV-805|Research Laboratory
CV-806|Project Laboratory
CV-807|Discussion Room
CV-808|Faculty Workspace`, 'Proposed placeholder');
  addFloor(cv, 'Ninth floor', `
CV-901|General Classroom
CV-902|General Classroom
CV-903|Smart Classroom
CV-904|Research Laboratory
CV-905|Computer Laboratory
CV-906|Seminar Room
CV-907|Faculty Workspace
CV-908|Project Room`, 'Proposed placeholder');
  addFloor(cv, 'Tenth floor', `
CV-1001|General Classroom
CV-1002|General Classroom
CV-1003|Smart Classroom
CV-1004|Research Laboratory
CV-1005|Computer Laboratory
CV-1006|Conference Room
CV-1007|Faculty Workspace
CV-1008|Project Laboratory`, 'Proposed placeholder');
  addFloor(cv, 'Eleventh floor', `
CV-1101|Research Laboratory
CV-1102|Research Laboratory
CV-1103|Faculty Workspace
CV-1104|Seminar Room
CV-1105|Conference Room
CV-1106|Discussion Room
CV-1107|Research Office
CV-1108|Research Workspace`, 'Proposed placeholder');
  addFloor(cv, 'Twelfth floor', `
CV-1201|Central Library|L
CV-1202|Library Reading Room|L
CV-1203|Digital Library|L
CV-1204|Library Discussion Room|L
CV-1205|Library Administration|L
CV-1206|Research Reading Area|L`, 'Proposed placeholder');
  addFloor(cv, 'Second floor', `
Cabin 9|CSE Faculty Cabin
Cabin 10|CSE Faculty Cabin
Cabin 14|CSE Faculty Cabin`, 'Provided directory entry');
  addFloor(cv, 'Third floor', `
Cabin 6|CSE Faculty Cabin
Cabin 7|CSE Faculty Cabin
Cabin 8|CSE Faculty Cabin
Cabin 12|ECE Faculty Cabin`, 'Provided directory entry');
  addFloor(cv, 'Fourth floor', 'Cabin 11|CSE Faculty Cabin', 'Provided directory entry');
  addFloor(cv, 'Fifth floor', `
Cabin 8|Mechanical Engineering Faculty Cabin
Cabin 10|Mechanical Engineering Faculty Cabin
Cabin 12|Mechanical Engineering Faculty Cabin`, 'Provided directory entry');
  addFloor(cv, 'Sixth floor', 'Cabin 5|CSE Faculty Cabin', 'Provided directory entry');
  addFloor(cv, 'Eleventh floor', `
Cubicle 19|Energy Engineering Faculty Office
Cubicle 133|CSE Faculty Office`, 'Provided directory entry');

  addFloor(sr, 'Basement', `
S-B01|Electrical Maintenance Room
S-B02|Storage Room
S-B03|Equipment Storage
S-B04|Network and Server Room
S-B05|Housekeeping Room`, 'Proposed placeholder');
  addFloor(sr, 'Ground floor', `
S-G01|Main Reception
S-G02|Security Office
S-G03|Administrative Office
S-G04|Student Help Desk
S-G05|Waiting Area
S-G06|Conference Room
S-G07|General Classroom
S-G08|Faculty Meeting Room
S-G10|Common Waiting Area`, 'Proposed placeholder');
  addFloor(sr, 'First floor', `
S-101|General Classroom
S-102|General Classroom
S-103|Smart Classroom
S-104|Computer Laboratory
S-105|Faculty Office
S-106|Seminar Room
S-107|Discussion Room
S-108|Department Office
S-109|Project Room
S-110|Research Laboratory`, 'Proposed placeholder');
  addFloor(sr, 'Second floor', `
S-201|General Classroom
S-202|General Classroom
S-203|Smart Classroom
S-204|Computer Laboratory
S-205|Seminar Room
S-206|Faculty Workspace
S-207|Discussion Room
S-208|Meeting Room
S-209|Teaching Learning Centre / Workshop Venue|D
S-210|Research Room`, 'Proposed placeholder');
  addFloor(sr, 'Third floor', `
S-301|General Classroom
S-302|General Classroom
S-303|Smart Classroom
S-304|Computer Laboratory
S-305|Seminar Room
S-306|Faculty Office
S-307|Research Laboratory
S-308|Discussion Room
S-309|Project Laboratory
S-310|Department Office`, 'Proposed placeholder');
  addFloor(sr, 'Fourth floor', `
S-401|General Classroom
S-402|General Classroom
S-403|Smart Classroom
S-404|Computer Laboratory
S-405|Seminar Room
S-406|Research Laboratory
S-407|Faculty Office
S-408|Discussion Room
S-409|Project Laboratory
S-410|Conference Room
S-416|Civil Engineering Guest Lecture Venue|D
Office 16|Faculty Office — ECE / Health Engineering|D`, 'Proposed placeholder');
  addFloor(sr, 'Fifth floor', `
S-501|General Classroom
S-502|Economics Workshop / Seminar Venue|D
S-503|General Classroom
S-504|Smart Classroom
S-505|Computer Laboratory
S-506|Research Laboratory
S-507|Faculty Office
S-508|Discussion Room
S-509|Project Laboratory
S-510|Department Office`, 'Proposed placeholder');
  addFloor(sr, 'Sixth floor', `
S-601|General Classroom
S-602|General Classroom
S-603|Smart Classroom
S-604|Computer Laboratory
S-605|Research Laboratory
S-606|Faculty Workspace
S-607|Seminar Room
S-608|Discussion Room
S-609|Project Laboratory
S-610|Conference Room`, 'Proposed placeholder');
  addFloor(sr, 'Seventh floor', `
S-701|General Classroom
S-702|Research Laboratory
S-703|Faculty Workspace
SR 704 / S-704|Mitochondrial Biogenesis Laboratory|D
S-705|Research Room
S-706|Seminar Room
S-707|Discussion Room
S-708|Project Laboratory
Cabin 9|CSE Faculty Office — Interdisciplinary Research|D`, 'Proposed placeholder');
  addFloor(sr, 'Campus facility', `
Theatre|Auditorium / Theatre Facility|D
Grand Stairs|Campus activity space|D`, 'Documented location');

  addFloor(xlab, 'Basement', `
X-B01|Electrical Maintenance Room
X-B02|Equipment Storage
X-B03|General Storage
X-B04|Network Room
X-B05|Housekeeping Room`, 'Proposed placeholder');
  addFloor(xlab, 'Ground floor', `
X-G01|Main Reception
X-G02|Security Office
X-G03|Visitor Waiting Area
X-G04|Administrative Office
X-G05|Student Help Desk
X-G06|Conference Room
Main Auditorium|Auditorium / Event Hall|D`, 'Proposed placeholder');
  addFloor(xlab, 'First floor', `
X-101|General Classroom
X-102|General Classroom
X-103|Smart Classroom
X-104|Computer Laboratory
X-105|Research Laboratory
X-106|Faculty Office
X-107|Discussion Room
X-108|Seminar Room
X-109|Project Laboratory
X-110|Department Office`, 'Proposed placeholder');
  addFloor(xlab, 'Second floor', `
X-201|General Classroom
X-202|Research Laboratory
X-203|Smart Classroom
X-204|Computer Laboratory
X-205|Research Laboratory
X-206|Faculty Office
X-207|Discussion Room
X-208|Seminar Room
X-209|Project Laboratory
X-210|Department Office`, 'Proposed placeholder');
  addFloor(xlab, 'Third floor', `
X-301A|Low Dimensional Materials Growth Laboratory|D
X-301B|Advanced Materials Laboratory|D
X-302A|Bio-nanotechnology & Sustainable Laboratory|D
X-303|Office of the Controller of Examinations|D
X-304|General Research Laboratory
X-305|Materials Characterisation Laboratory
X-306|Chemistry Research Laboratory
X-307|Interdisciplinary Research Laboratory
X-308|SRM Amara Raja Centre for Energy Storage Devices (CESD)|D
X-309|Functional Nanomaterials Laboratory|D
X-310|Research Laboratory
X-311|Workshop / Multiscale Modelling Venue|D
X-312|Research Laboratory
X-313|Laboratory of Phage and Bacterial Biology|D
X-314|Project Laboratory
X-315|Faculty Research Office`, 'Proposed placeholder');
  addFloor(xlab, 'Fourth floor', `
X-401|General Classroom
X-402|Smart Classroom
X-403|Computer Laboratory
X-404|Research Laboratory
X-405|Faculty Workspace
X-406|Seminar Room
X-407|Discussion Room
X-408|Project Laboratory
X-409|Conference Room
X-410|Department Office`, 'Proposed placeholder');
  addFloor(xlab, 'Fifth floor', `
X-501|General Classroom
X-502|Research Laboratory
X-503|Smart Classroom
X-504|Computer Laboratory
X-505|Project Laboratory
X-506|Seminar Room
X-507|Faculty Workspace
X-508|Discussion Room
X-509|Research Office
X-510|Conference Room`, 'Proposed placeholder');
  addFloor(xlab, 'Building-wide facility',
    'X-Lab|Interdisciplinary Research Facilities|D', 'Documented location');
  addFloor(xlab, 'Third floor', `
X-309 Cabin 15|Functional Nanomaterials Laboratory — Cabin 15
X-313 Laboratory workspace|Laboratory workspace — Phage and Bacterial Biology
X-302A Laboratory workspace|Laboratory workspace — Bio-nanotechnology & Sustainable Laboratory`, 'Documented sub-location');

  addFloor(jc, 'Basement', `
JC-B01|Electrical Maintenance Room
JC-B02|Equipment Storage
JC-B03|General Storage
JC-B04|Network and Server Room
JC-B05|Housekeeping Room`, 'Proposed placeholder');
  addFloor(jc, 'Ground floor', `
JC-G01|Main Reception
JC-G02|Security Office
JC-G03|Administrative Office
JC-G04|Student Help Desk
JC-G05|Waiting Area
JC-G06|Conference Room
JC-G07|General Classroom
JC-G08|Seminar Hall
JC-G09|Faculty Meeting Room
JC-G10|Common Area`, 'Proposed placeholder');
  addFloor(jc, 'First floor', `
JC-101|General Classroom
JC-102|General Classroom
JC-103|Smart Classroom
JC-104|Computer Laboratory
JC-105|Physics Laboratory
JC-106|Faculty Office
JC-107|Discussion Room
JC-108|Seminar Room
JC-109|Research Laboratory
JC-110|Department Office
JC-111|Project Laboratory
JC-112|Electronics Laboratory`, 'Proposed placeholder');
  addFloor(jc, 'Second floor', `
JC-201|General Classroom
JC-202|Smart Classroom
JC-203|Physics Laboratory
JC-204|Research Laboratory
JC-205|Faculty Workspace
JC-206|Discussion Room
JC-207|Seminar Room
JC-208|Computer Laboratory
JC-209|Department Office
JC-210|Project Laboratory
JC-217|Exotic Interface Laboratory|D
JC-218|Research Laboratory
JC-219|Chemical Biology Laboratory|D`, 'Proposed placeholder');
  addFloor(jc, 'Third floor', `
JC-301|General Classroom
JC-302|Smart Classroom
JC-303|Physics Laboratory
JC-304|Chemistry Laboratory
JC-305|Research Laboratory
JC-306|Faculty Office
JC-307|Discussion Room
JC-308|Seminar Room
JC-309|Project Laboratory
JC-310|Electronics Laboratory
JC-311|Research Workspace
JC-312|Device Physics Laboratory|D
JC-313|Solid State Ionics Laboratory|D
JC-314|2D Materials and Devices Laboratory|D
JC-315|Piezoceramics Laboratory|D`, 'Proposed placeholder');
  addFloor(jc, 'Fourth floor', `
JC-401|General Classroom
JC-402|Smart Classroom
JC-403|Singular Optics Laboratory|D
JC-404|Research Laboratory
JC-405|Physics Laboratory
JC-406|Chemistry Laboratory
JC-407|Faculty Workspace
JC-408|Seminar Room
JC-409|Discussion Room
JC-410|Project Laboratory
JC-411|Conference Room
JC-412|Department Office`, 'Proposed placeholder');
  addFloor(jc, 'Fifth floor', `
JC-501|General Classroom
JC-502|Smart Classroom
JC-503|Research Laboratory
JC-504|Physics Laboratory
JC-505|Chemistry Laboratory
JC-506|Faculty Office
JC-507|Seminar Room
JC-508|Discussion Room
JC-509|Project Laboratory
JC-510|Research Workspace`, 'Proposed placeholder');

  addFloor(vikram, 'Basement', `
V-B01|Electrical Maintenance Room
V-B02|General Storage
V-B03|Housekeeping Room
V-B04|Network and Server Room
V-B05|Utility Room`, 'Proposed placeholder');
  addFloor(vikram, 'Ground floor', `
V-G01|Main Reception
V-G02|Security Office
V-G03|Visitor Waiting Area
V-G04|Administrative Office
V-G05|Student Help Desk
V-G06|Conference Room
V-G07|General Classroom
V-G08|Faculty Meeting Room
V-G09|Seminar Room
V-G10|Common Waiting Area`, 'Proposed placeholder');
  addFloor(vikram, 'First floor', `
W-104A|Nuclear Magnetic Resonance Spectrometry Laboratory / Glove Box Laboratory|D
V101|General Classroom
V102|Smart Classroom
V103|Faculty Room
V104|Discussion Room
V105|Seminar Room
V106|Research Laboratory
V107|Department Office
V108|Computer Laboratory`, 'Proposed placeholder');
  addFloor(vikram, 'Second floor', `
V201|General Classroom
V202|Smart Classroom
V203|Faculty Room
V204|Examination Hall|D
V205|Discussion Room
V206|Examination Hall|D
V207|Examination Hall|D
V208|Seminar Room
V209|Examination Hall|D
V210|Computer Laboratory`, 'Proposed placeholder');
  addFloor(vikram, 'Third floor', `
V301|General Classroom
V302|Smart Classroom
V303|Faculty Room
V304|Discussion Room
V305|Seminar Room
V306|Research Laboratory
V307|Computer Laboratory
V308|Department Office
V309|Project Room
V310|Meeting Room`, 'Proposed placeholder');
  addFloor(vikram, 'Fourth floor', `
V401|General Classroom
V402|Examination Hall|D
V403|Smart Classroom
V404|Faculty Room
V405|Examination Hall|D
V406|Examination Hall|D
V407|Examination Hall|D
V408|Examination Hall|D
V409|Discussion Room
V410|Seminar Room`, 'Proposed placeholder');
  addFloor(vikram, 'Fifth floor', `
V501|Examination Hall|D
V502|Examination Hall|D
V503|General Classroom
V504|Examination Hall|D
V505|Smart Classroom
V506|Faculty Room
V507|Discussion Room
V508|Seminar Room
V509|Research Laboratory
V510|Meeting Room`, 'Proposed placeholder');

  addFloor(bhabha, 'Basement', `
HJB-B01|Electrical Maintenance Room
HJB-B02|General Storage
HJB-B03|Housekeeping Room
HJB-B04|Network and Server Room
HJB-B05|Utility Room`, 'Proposed placeholder');
  addFloor(bhabha, 'Ground floor', `
HJB-G01|Main Reception
HJB-G02|Security Office
HJB-G03|Visitor Waiting Area
HJB-G04|Administrative Office
HJB-G05|Student Help Desk
HJB-G06|Conference Room
HJB-G07|General Classroom
HJB-G08|Faculty Meeting Room
HJB-G09|Seminar Room
HJB-G10|Common Waiting Area`, 'Proposed placeholder');
  addFloor(bhabha, 'First floor', `
HJB-101|General Classroom
HJB-102|Smart Classroom
HJB-103|Faculty Room
HJB-104|Discussion Room
HJB-105|Seminar Room
HJB-106|Research Laboratory
HJB-107|Computer Laboratory
HJB-108|Department Office
HJB-109|Project Room
HJB-110|Meeting Room`, 'Proposed placeholder');
  addFloor(bhabha, 'Second floor', `
HJB-201|General Classroom
HJB-202|Smart Classroom
HJB-203|Faculty Room
HJB-204|Discussion Room
HJB-205|Research Laboratory
HJB-206|Computer Laboratory
HJB-207|Seminar Room
HJB-208|Department Office
HJB-209|Project Room
HJB-210|Meeting Room`, 'Proposed placeholder');
  addFloor(bhabha, 'Third floor', `
HJB-L3-ALC1|Active Learning Classroom I (ALC-I)|L
HJB-301|General Classroom
HJB-302|Smart Classroom
HJB-303|Faculty Room
HJB-304|Discussion Room
HJB-305|Seminar Room
HJB-306|Research Laboratory
HJB-307|Computer Laboratory
HJB-308|Project Room
HJB-309|Meeting Room`, 'Proposed placeholder');
  addFloor(bhabha, 'Fourth floor', `
HJB-401|International Relations and Higher Studies Office|D
HJB-402|Faculty Room
HJB-403|General Classroom
HJB-404|Smart Classroom
HJB-405|Discussion Room
HJB-406|Seminar Room
HJB-407|Research Laboratory
HJB-408|Computer Laboratory
HJB-409|Project Room
HJB-410|Meeting Room
Cubicle 42|Faculty Office — Dr G. V. Vidyalakshmi|D
Cubicle 47|Faculty Office — Dr Kammula Sunil Kumar|D`, 'Proposed placeholder');
  addFloor(bhabha, 'Fifth floor', `
HJB-L5-TC01|Tiered Classroom|L
HJB-502|General Classroom
HJB-503|Smart Classroom
HJB-504|Faculty Room
HJB-505|Discussion Room
HJB-506|Seminar Room
HJB-507|Research Laboratory
HJB-508|Computer Laboratory
HJB-509|Project Room
HJB-510|Meeting Room`, 'Proposed placeholder');
  addFloor(bhabha, 'Sixth floor', `
HJB-601|General Classroom
HJB-602|Smart Classroom
HJB-603|Faculty Room
HJB-604|Discussion Room
HJB-605|Seminar Room
HJB-606|Research Laboratory
HJB-607|Computer Laboratory
HJB-608|Project Room
HJB-609|Meeting Room
Cubicle 56|Faculty Office — Dr Anumol Joseph|D`, 'Proposed placeholder');
  addFloor(bhabha, 'Campus facility', 'HJB-BR01|Board Room', 'Proposed placeholder');

  addFloor(admin, 'Basement', `
NAB-B01|Electrical Maintenance Room
NAB-B02|General Storage
NAB-B03|Housekeeping Room
NAB-B04|Network and Server Room
NAB-B05|Records Storage`, 'Provided directory entry');
  addFloor(admin, 'Ground floor', `
NAB-G01|Main Reception
NAB-G02|Security Office
NAB-G03|Visitor Waiting Area
NAB-G04|Enquiry and Help Desk
NAB-G05|Admissions Office
NAB-G06|Accounts Enquiry
NAB-G07|Conference Room
NAB-G08|General Waiting Area
NAB-G09|Administrative Office
NAB-G10|Meeting Room`, 'Provided directory entry');
  addFloor(admin, 'First floor', `
NAB-101|Office of the Registrar
NAB-102|Registrar's Meeting Room
NAB-103|Examination Administration
NAB-104|Academic Records Section
NAB-105|Student Records Section
NAB-106|Document Verification
NAB-107|Administrative Staff Office
NAB-108|Conference Room
NAB-109|Meeting Room
NAB-110|File and Records Room`, 'Provided directory entry');
  addFloor(admin, 'Second floor', `
NAB-201|Office of the Vice Chancellor
NAB-202|Vice Chancellor's Meeting Room
NAB-203|Office of the Pro-Vice Chancellor
NAB-204|Executive Office
NAB-205|Board Meeting Room
NAB-206|Administrative Office
NAB-207|Personal Secretary Office
NAB-208|Conference Room
NAB-209|Waiting Lounge
NAB-210|Records Room`, 'Provided directory entry');
  addFloor(admin, 'Third floor', `
NAB-301|Finance and Accounts Office
NAB-302|Fee Payment Support
NAB-303|Payroll Section
NAB-304|Purchase and Procurement Office
NAB-305|Internal Audit Office
NAB-306|Budget and Finance Section
NAB-307|Staff Office
NAB-308|Meeting Room
NAB-309|Conference Room
NAB-310|Records Room`, 'Provided directory entry');
  addFloor(admin, 'Fourth floor', `
NAB-401|Human Resources Office
NAB-402|Faculty Recruitment Section
NAB-403|Staff Recruitment Section
NAB-404|Employee Records
NAB-405|Establishment Section
NAB-406|Training and Development Office
NAB-407|Staff Meeting Room
NAB-408|Conference Room
NAB-409|Administrative Office
NAB-410|Records Room`, 'Provided directory entry');
  addFloor(admin, 'Fifth floor', `
NAB-501|International Relations Office
NAB-502|Accreditation and Ranking Office
NAB-503|Quality Assurance Office
NAB-504|Planning and Development Office
NAB-505|Public Relations Office
NAB-506|Legal and Compliance Office
NAB-507|Administrative Office
NAB-508|Conference Room
NAB-509|Meeting Room
NAB-510|Records Room`, 'Provided directory entry');
  addFloor(admin, 'Sixth floor', `
NAB-601|University Administration Office
NAB-602|Directorate Office
NAB-603|Strategic Planning Office
NAB-604|Senior Management Meeting Room
NAB-605|Board Room
NAB-606|Conference Hall
NAB-607|Staff Lounge
NAB-608|Administrative Office`, 'Provided directory entry');

  root.CAMPUS_ROOM_DIRECTORY = rooms;
})(window);

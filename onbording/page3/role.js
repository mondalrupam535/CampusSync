(function () {
  var STUDENT_DEPARTMENTS = {
    'Computer Science and Engineering': [['School of Engineering and Sciences (SEAS)', 'Computer Science & Engineering (CSE)']],
    'Electrical and Electronics Engineering': [['School of Engineering and Sciences (SEAS)', 'Electronics & Communication (EEE)']],
    'Electronics and Communication Engineering': [['School of Engineering and Sciences (SEAS)', 'Electronics & Communication (EEE)']],
    'Mechanical Engineering': [['School of Engineering and Sciences (SEAS)', 'Mechanical Engineering (ME)']],
    'Civil Engineering': [['School of Engineering and Sciences (SEAS)', 'Civil Engineering (CE)']],
    'Mathematics and Sciences': [
      ['School of Engineering and Sciences (SEAS)', 'Biological Sciences (BS)'],
      ['School of Engineering and Sciences (SEAS)', 'Chemistry'],
      ['School of Engineering and Sciences (SEAS)', 'Physics']
    ],
    'English and Literature': [['Easwari School of Liberal Arts (ESLA)', 'Literature & Languages']],
    'Psychology': [['Easwari School of Liberal Arts (ESLA)', 'Psychology']],
    'Economics': [['Easwari School of Liberal Arts (ESLA)', 'Economics']],
    'Political Science': [['Easwari School of Liberal Arts (ESLA)', 'Political Sciences']],
    'Sociology': [['Easwari School of Liberal Arts (ESLA)', 'Sociology & Anthropology']],
    'History': [['Easwari School of Liberal Arts (ESLA)', 'History']],
    'Management': [['Paari School of Business (PSB)', 'Department of Management']],
    'Commerce': [['Paari School of Business (PSB)', 'Department of Commerce']],
    'Finance': [['Paari School of Business (PSB)', 'Department of Management']],
    'Marketing': [['Paari School of Business (PSB)', 'Department of Management']],
    'Operations and Analytics': [['Paari School of Business (PSB)', 'Department of Management']],
    'Human Resources': [['Paari School of Business (PSB)', 'Department of Management']]
  };
  var CATALOG = window.CampusSyncStudentCatalog;
  if (!CATALOG) throw new Error('Student specialization catalog was not loaded.');

  var DEPARTMENT_POSTS = {
    // Academic Departments
    'Computer Science and Engineering': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Electrical and Electronics Engineering': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Electronics and Communication Engineering': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Mechanical Engineering': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Civil Engineering': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Mathematics and Sciences': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],

    'English and Literature': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Psychology': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Economics': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Political Science': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Sociology': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'History': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],

    'Management': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Commerce': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Finance': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Marketing': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Operations and Analytics': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],
    'Human Resources': ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department (HOD)', 'Dean', 'Teaching Assistant'],

    // Administrative Departments
    'Admissions': ['Director of Admissions', 'Associate Director', 'Deputy Director', 'Admissions Officer', 'Admissions Executive', 'Admissions Counsellor'],
    'Finance and Accounts': ['Chief Finance and Accounts Officer', 'Finance Manager', 'Accounts Officer', 'Accounts Executive', 'Fee Management Officer'],
    'Human Resources (HR)': ['Director of HR', 'HR Manager', 'HR Executive', 'Recruitment Officer', 'Payroll Officer'],
    'Transport': ['Transport Manager', 'Transport Officer', 'Fleet Manager', 'Route Coordinator', 'Bus In-charge'],
    'Campus Infrastructure and Maintenance': ['Director of Infrastructure and Maintenance', 'Facilities Manager', 'Maintenance Supervisor', 'Electrical Technician', 'Plumbing Technician'],
    'Information Technology and Knowledge Management (ITKM)': ['Director of ITKM', 'IT Manager', 'System Administrator', 'Network Administrator', 'IT Support Executive'],
    'Student Affairs': ['Director of Student Affairs', 'Student Affairs Officer', 'Student Support Executive', 'Student Grievance Officer', 'Student Welfare Coordinator'],
    'Student Discipline and Hostels': ['Director of Student Discipline and Hostels', 'Hostel Warden', 'Assistant Warden', 'Hostel Supervisor', 'Discipline Officer'],
    'Corporate Relations and Career Services (CR&CS)': ['Director of Corporate Relations and Career Services', 'Placement Officer', 'Training Coordinator', 'Internship Coordinator', 'Corporate Relations Executive'],
    'International Relations and Higher Studies (IR&HS)': ['Director of International Relations', 'International Exchange Coordinator', 'Study Abroad Officer', 'International Admissions Officer'],
    'Communications': ['Director of Communications', 'Public Relations Officer', 'Communications Manager', 'Content Executive', 'Media Relations Officer'],
    'Alumni Relations': ['Director of Alumni Relations', 'Alumni Coordinator', 'Alumni Engagement Officer', 'Alumni Relations Executive'],
    'Sports': ['Director of Sports', 'Sports Coordinator', 'Coach', 'Sports Facilities Manager'],
    'Campus Life': ['Campus Life Director', 'Events Coordinator', 'Student Activities Coordinator', 'Campus Experience Officer'],
    'Research': ['Dean of Research', 'Associate Dean of Research', 'Research Coordinator', 'Research Project Officer'],
    'Academic Affairs': ['Dean of Academic Affairs', 'Associate Dean', 'Academic Coordinator', 'Academic Operations Officer'],
    'Examinations': ['Controller of Examinations', 'Deputy Controller of Examinations', 'Examination Officer', 'Examination Coordinator'],
    'Quality Assurance and Rankings (QAR)': ['Associate Dean of QAR', 'Quality Assurance Officer', 'Accreditation Coordinator', 'Rankings Coordinator'],
    'Library': ['University Librarian', 'Deputy Librarian', 'Assistant Librarian', 'Library Assistant'],
    'Entrepreneurship and Innovation': ['Director of Entrepreneurship and Innovation', 'Innovation Coordinator', 'Startup Incubation Manager', 'Entrepreneurship Program Officer'],
    'Teaching and Learning Centre (TLC)': ['Director of TLC', 'Faculty Development Coordinator', 'Teaching Support Officer'],
    "Registrar's Office": ['Registrar', 'Deputy Registrar', 'Assistant Registrar', 'Administrative Officer'],
    'Facility Management': ['Director of Facility Management', 'Facility Manager', 'Operations Supervisor', 'Facility Support Executive'],
    'Executive Education and Professional Studies (DEEPS)': ['Director of DEEPS', 'Program Manager', 'Executive Education Coordinator'],
    'Technology Transfer Cell': ['Associate Dean of Technology Transfer', 'Technology Transfer Officer', 'Intellectual Property Coordinator'],
    'Health and Wellness': ['Wellness Centre Coordinator', 'Counsellor', 'Medical Officer', 'Nursing Officer'],
    'Security': ['Security Manager', 'Security Supervisor', 'Security Officer'],
    'Procurement and Stores': ['Procurement Manager', 'Purchase Officer', 'Inventory Controller', 'Stores Officer'],
    'Legal and Compliance': ['Legal Officer', 'Compliance Officer', 'Contract Management Officer'],
    'General Administration': ['Administrative Manager', 'Office Superintendent', 'Administrative Assistant', 'Office Assistant']
  };

  var form = document.getElementById('role-form');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('#category button'));
  var dept = document.getElementById('dept');
  var administrativeDepartments = document.getElementById('administrative-departments');
  var designationField = document.getElementById('designation-field');
  var designation = document.getElementById('designation');
  var specializationField = document.getElementById('student-specialization-field');
  var specialization = document.getElementById('student-specialization');
  var joining = document.getElementById('joining');
  var category = 'student';

  // Restore saved choices
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('onboarding.role') || '{}'); } catch (e) {}
  if (saved.category) setCategory(saved.category);
  if (saved.dept) {
    dept.value = saved.dept;
    updateDesignations(saved.dept, saved.designation);
    updateStudentSpecializations(saved.dept, saved.specialization);
  }
  if (saved.joining) joining.value = saved.joining;
  setCategory(category);
  syncPlaceholder(dept);
  syncPlaceholder(designation);
  syncPlaceholder(specialization);

  // Category selector
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.value !== category) {
        try { localStorage.removeItem('onboarding.step3'); } catch (error) {
          console.error('Unable to reset the role-specific setup step:', error);
          alert('Could not update your role. Check browser storage settings and try again.');
          return;
        }
      }
      setCategory(btn.dataset.value);
    });
  });

  function setCategory(value) {
    category = value;
    buttons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.value === value ? 'true' : 'false');
    });
    var isStudent = value === 'student';
    administrativeDepartments.disabled = isStudent;
    var selectedDepartment = dept.options[dept.selectedIndex];
    if (isStudent && selectedDepartment && selectedDepartment.parentElement === administrativeDepartments) {
      dept.value = '';
      updateDesignations('', '');
      updateStudentSpecializations('', '');
      syncPlaceholder(dept);
      setError(dept, '');
    }
    designationField.hidden = isStudent;
    designation.required = !isStudent;
    designation.disabled = isStudent || !DEPARTMENT_POSTS[dept.value];
    specializationField.hidden = !isStudent;
    specialization.required = isStudent;
    specialization.disabled = !isStudent || !specialization.options.length || specialization.options.length === 1;
    setError(specialization, '');
    setError(joining, '');
    if (isStudent) setError(designation, '');
  }

  // Update designation options based on selected department
  function updateDesignations(selectedDept, selectedDesignation) {
    designation.innerHTML = '';
    var posts = DEPARTMENT_POSTS[selectedDept] || [];
    
    var firstOpt = document.createElement('option');
    firstOpt.value = '';
    firstOpt.textContent = posts.length ? 'Select your designation' : 'Select department first';
    firstOpt.selected = true;
    designation.appendChild(firstOpt);

    posts.forEach(function (post) {
      var opt = document.createElement('option');
      opt.value = post;
      opt.textContent = post;
      designation.appendChild(opt);
    });

    designation.disabled = category === 'student' || !posts.length;
    if (selectedDesignation && posts.indexOf(selectedDesignation) !== -1) {
      designation.value = selectedDesignation;
    }
    syncPlaceholder(designation);
  }

  function updateStudentSpecializations(selectedDept, selectedSpecialization) {
    specialization.innerHTML = '';
    var firstOpt = document.createElement('option');
    firstOpt.value = '';
    firstOpt.selected = true;
    var options = [];
    var departments = STUDENT_DEPARTMENTS[selectedDept] || [];
    departments.forEach(function (location) {
      var programs = CATALOG[location[0]] && CATALOG[location[0]][location[1]];
      Object.keys(programs || {}).forEach(function (program) {
        programs[program].forEach(function (item) {
          if (options.indexOf(item) === -1) options.push(item);
        });
      });
    });
    firstOpt.textContent = options.length ? 'Select your specialization' : 'Select an academic department first';
    specialization.appendChild(firstOpt);
    options.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item;
      option.textContent = item.trim();
      specialization.appendChild(option);
    });
    specialization.disabled = category !== 'student' || !options.length;
    if (selectedSpecialization && options.indexOf(selectedSpecialization) !== -1) {
      specialization.value = selectedSpecialization;
    }
    syncPlaceholder(specialization);
  }

  // Grey placeholder text on selects
  function syncPlaceholder(select) {
    select.classList.toggle('is-placeholder', select.value === '');
  }

  dept.addEventListener('change', function () {
    syncPlaceholder(dept);
    setError(dept, '');
    updateDesignations(dept.value, '');
    updateStudentSpecializations(dept.value, '');
    setError(specialization, '');
  });

  designation.addEventListener('change', function () {
    syncPlaceholder(designation);
    setError(designation, '');
  });

  specialization.addEventListener('change', function () {
    syncPlaceholder(specialization);
    setError(specialization, '');
  });

  joining.addEventListener('input', function () {
    joining.value = joining.value.replace(/\D/g, '');
    setError(joining, '');
  });

  function setError(input, message) {
    var box = document.getElementById(input.id + '-error');
    box.textContent = message;
    input.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var ok = true;

    if (!dept.value) { setError(dept, 'Please choose your department or unit.'); ok = false; }
    if (category !== 'student' && !designation.value) {
      setError(designation, 'Please choose your designation.');
      ok = false;
    }
    if (category === 'student' && !specialization.value) {
      setError(specialization, specialization.disabled
        ? 'No specialization list is available. Please choose an academic department.'
        : 'Please choose your specialization.');
      ok = false;
    }

    var year = joining.value.trim();
    var maxYear = new Date().getFullYear() + 1;
    if (!year) {
      setError(joining, 'Joining year is required.');
      ok = false;
    } else if (year && (year.length !== 4 || +year < 1990 || +year > maxYear)) {
      setError(joining, 'Enter a valid four-digit year.');
      ok = false;
    }

    if (!ok) {
      (document.querySelector('.is-invalid') || dept).focus();
      return;
    }

    try {
      var role = {
        category: category,
        dept: dept.value,
        designation: category === 'student' ? '' : designation.value,
        specialization: category === 'student' ? specialization.value : '',
        joining: year
      };
      localStorage.setItem('onboarding.role', JSON.stringify(role));
      await window.CampusSyncAPI.saveOnboardingStep('role', role);
    } catch (error) {
      console.error('Unable to save role and department:', error);
      alert('Could not save your role and department to the CampusSync server: ' + error.message);
      return;
    }

    // Students go to academic details, faculty and staff to employment details
    window.location.href = category === 'student' ? '../page4/index.html' : 'staff.html';
  });

  // Mouse tilt interaction on the showcase side panel
  var showcase = document.querySelector('.showcase');
  if (showcase) {
    showcase.addEventListener('mousemove', function (e) {
      var rect = showcase.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      var moveX = (x / rect.width) * 12;
      var moveY = (y / rect.height) * 12;
      showcase.style.transform = 'perspective(1000px) rotateY(' + moveX + 'deg) rotateX(' + (-moveY) + 'deg)';
      showcase.style.transition = 'transform 0.1s ease-out';
    });

    showcase.addEventListener('mouseleave', function () {
      showcase.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
      showcase.style.transition = 'transform 0.5s ease';
    });
  }
})();
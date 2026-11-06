(function (root, factory) {
  var departments = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = departments;
  else root.CAMPUS_DEPARTMENTS = departments;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var academic = [
    'School of Engineering and Sciences (SEAS)',
    'Computer Science and Engineering',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Mathematics and Sciences',
    'Easwari School of Liberal Arts (ESLA)',
    'English and Literature',
    'Psychology',
    'Economics',
    'Political Science',
    'Sociology',
    'History',
    'Paari School of Business (PSB)',
    'Management',
    'Commerce',
    'Finance',
    'Marketing',
    'Operations and Analytics',
    'Human Resources (academic)'
  ];

  var administrative = [
    'Admissions',
    'Finance and Accounts',
    'Human Resources (HR)',
    'Transport',
    'Campus Infrastructure and Maintenance',
    'Information Technology and Knowledge Management (ITKM)',
    'Student Affairs',
    'Student Discipline and Hostels',
    'Corporate Relations and Career Services (CR&CS)',
    'International Relations and Higher Studies (IR&HS)',
    'Communications',
    'Alumni Relations',
    'Sports',
    'Campus Life',
    'Research',
    'Academic Affairs',
    'Examinations',
    'Quality Assurance and Rankings (QAR)',
    'Library',
    'Entrepreneurship and Innovation',
    'Teaching and Learning Centre (TLC)',
    "Registrar's Office",
    'Facility Management',
    'Executive Education and Professional Studies (DEEPS)',
    'Technology Transfer Cell',
    'Health and Wellness',
    'Security',
    'Procurement and Stores',
    'Legal and Compliance',
    'General Administration'
  ];

  return {
    academic: academic,
    administrative: administrative,
    all: academic.concat(administrative)
  };
});

package campussync.assistant;

import java.util.ArrayList;
import java.util.List;

final class DepartmentCatalog {
    private static final List<String> DEPARTMENTS = List.of(
            "School of Engineering and Sciences (SEAS)",
            "Computer Science and Engineering",
            "Electrical and Electronics Engineering",
            "Electronics and Communication Engineering",
            "Mechanical Engineering",
            "Civil Engineering",
            "Mathematics and Sciences",
            "Easwari School of Liberal Arts (ESLA)",
            "English and Literature",
            "Psychology",
            "Economics",
            "Political Science",
            "Sociology",
            "History",
            "Paari School of Business (PSB)",
            "Management",
            "Commerce",
            "Finance",
            "Marketing",
            "Operations and Analytics",
            "Human Resources (academic)",
            "Admissions",
            "Finance and Accounts",
            "Human Resources (HR)",
            "Transport",
            "Campus Infrastructure and Maintenance",
            "Information Technology and Knowledge Management (ITKM)",
            "Student Affairs",
            "Student Discipline and Hostels",
            "Corporate Relations and Career Services (CR&CS)",
            "International Relations and Higher Studies (IR&HS)",
            "Communications",
            "Alumni Relations",
            "Sports",
            "Campus Life",
            "Research",
            "Academic Affairs",
            "Examinations",
            "Quality Assurance and Rankings (QAR)",
            "Library",
            "Entrepreneurship and Innovation",
            "Teaching and Learning Centre (TLC)",
            "Registrar's Office",
            "Facility Management",
            "Executive Education and Professional Studies (DEEPS)",
            "Technology Transfer Cell",
            "Health and Wellness",
            "Security",
            "Procurement and Stores",
            "Legal and Compliance",
            "General Administration"
    );

    private DepartmentCatalog() {
    }

    static List<String> departments(boolean includeUniversityWide) {
        if (!includeUniversityWide) return DEPARTMENTS;
        List<String> options = new ArrayList<>(DEPARTMENTS.size() + 1);
        options.add("University-wide");
        options.addAll(DEPARTMENTS);
        return List.copyOf(options);
    }

    static boolean contains(String department, boolean includeUniversityWide) {
        return departments(includeUniversityWide).contains(department);
    }
}

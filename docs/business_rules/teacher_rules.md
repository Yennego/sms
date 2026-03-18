# Teacher Business Rules

## Teacher Status

Teachers can have the following statuses:
- **active**: Currently employed and teaching
- **inactive**: Temporarily not teaching (e.g., sabbatical, leave)
- **terminated**: No longer employed by the school

## Class Teacher Assignment

- A teacher can be assigned as the primary class teacher for only one grade and section
- Only one teacher can be the primary class teacher for a specific grade and section
- Class teachers have additional responsibilities for their assigned class

## Subject Teaching

- Teachers can teach multiple subjects based on their qualifications
- A teacher can be assigned to multiple classes for teaching different subjects
- There are limits to how many classes a teacher can be assigned to teach

## Employee IDs

Teacher employee IDs must:
- Be unique within a tenant
- Follow the format: EMP-YYYY-NNNN where YYYY is the joining year and NNNN is a sequential number
- Example: EMP-2023-0042
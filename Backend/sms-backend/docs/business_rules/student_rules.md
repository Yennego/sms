# Student Business Rules

## Status Transitions

Students can have the following statuses:

- **active**: Currently enrolled and attending
- **inactive**: Temporarily not attending (e.g., extended absence)
- **graduated**: Completed their education at the school
- **transferred**: Moved to another school

Valid status transitions:

| Current Status | Valid Next Statuses |
|----------------|---------------------|
| active         | inactive, graduated, transferred |
| inactive       | active |
| graduated      | (none - terminal state) |
| transferred    | (none - terminal state) |

## Grade Promotion

Grade promotion follows this sequence:

1. Kindergarten
2. Grade 1
3. Grade 2
4. Grade 3
5. Grade 4
6. Grade 5
7. Grade 6
8. Grade 7
9. Grade 8
10. Grade 9
11. Grade 10
12. Grade 11
13. Grade 12

Business rules for promotion:

1. Only active students can be promoted
2. Students can only be promoted to the next grade in the sequence
3. Students in Grade 12 cannot be promoted further and should be graduated instead
4. Promotion automatically updates the student's academic history

## Graduation

Business rules for graduation:

1. Only Grade 12 students can graduate
2. Only active students can graduate
3. Graduation is a terminal state (cannot transition to other statuses)
4. Graduation details include graduation date and optional honors

## Admission Numbers

Admission numbers must:
- Be unique within a tenant
- Follow the format: YYYY-NNNN where YYYY is the admission year and NNNN is a sequential number
- Example: 2023-0042

## Academic History

Each student maintains an academic history that records:
- Previous grades and sections
- Academic year
- Promotion date

This history is automatically updated during grade promotions and other significant events.
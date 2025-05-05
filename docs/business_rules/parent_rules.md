# Parent Business Rules

## Parent-Student Relationships

- A parent can be associated with multiple students
- A student can have multiple parents/guardians
- Adding or removing a student from a parent requires validation that both entities exist

## Communication Preferences

Parents can set the following communication preferences:

### Contact Methods
- **email**: Communication via email
- **sms**: Communication via text messages
- **phone**: Communication via phone calls
- **app**: Communication via the school app

### Notification Frequency
- **immediate**: Send notifications as soon as events occur
- **daily**: Aggregate notifications and send once per day
- **weekly**: Aggregate notifications and send once per week

### Notification Types
- **attendance**: Notifications about student attendance
- **grades**: Notifications about grades and assessments
- **behavior**: Notifications about student behavior
- **events**: Notifications about school events
- **emergency**: Emergency notifications (always immediate regardless of frequency setting)

### Other Preferences
- Language preference
- Time restrictions (e.g., do not contact between certain hours)

## Parent Status

Parents can have the following statuses:
- **active**: Currently associated with at least one active student
- **inactive**: No longer associated with any active students

When a parent is deactivated, the system records:
- Deactivation date
- Reason for deactivation
select r.[Id], u.[Name],
	r.[Title]
from {Request} r
join {User} u on u.[Id] = r.[AssignedToUserId]
where r.[IsDeleted] = 0

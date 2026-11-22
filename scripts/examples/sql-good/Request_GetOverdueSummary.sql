/* Request_GetOverdueSummary: overdue requests per assignee (SQL Server) */
SELECT {Request}.[AssignedToUserId], COUNT(1)
FROM {Request}
WHERE {Request}.[IsDeleted] = 0
  AND {Request}.[StatusId] = @SubmittedStatusId
  AND {Request}.[DueOn] < @Now
  AND {Request}.[Title] LIKE @Search + '%'
GROUP BY {Request}.[AssignedToUserId]
ORDER BY COUNT(1) DESC
OFFSET 0 ROWS FETCH NEXT @MaxRecords ROWS ONLY

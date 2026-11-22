/* Request_GetOverdueByAssignee: overdue requests per assignee */
SELECT
	{Request}.[AssignedToUserId]
	,COUNT(1) AS OverdueCount
FROM
	{Request}
	INNER JOIN {User} AS Assignee ON Assignee.[Id] = {Request}.[AssignedToUserId]
WHERE
	{Request}.[IsDeleted] = 0
	AND {Request}.[DueOn] < @Now
GROUP BY
	{Request}.[AssignedToUserId]
ORDER BY
	COUNT(1) DESC
OFFSET 0 ROWS FETCH NEXT @MaxRecords ROWS ONLY

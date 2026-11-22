-- deliberately wrong examples
SELECT * FROM OSUSR_ABC_REQUEST WITH (NOLOCK);
SELECT {Request}.[Id], {Request}.[Title]
FROM {Request}
WHERE UPPER({Request}.[Title]) = @Title
  AND {Request}.[StatusId] = 3
  AND {Request}.[Id] IN (@Ids)
ORDER BY @SortBy;
UPDATE {Request} SET [IsDeleted] = 1;
EXEC('SELECT 1');
DECLARE c CURSOR FOR SELECT {Request}.[Id] FROM {Request} WHERE {Request}.[Title] LIKE '%' + @Search

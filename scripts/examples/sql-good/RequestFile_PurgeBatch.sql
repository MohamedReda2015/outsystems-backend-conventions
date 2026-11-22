-- RequestFile_PurgeBatch: deletes one batch of files past retention (SQL Server)
DELETE TOP (@BatchSize) F
FROM {RequestFile} F
WHERE F.[IsDeleted] = 1
  AND F.[DeletedOn] < @CutOff

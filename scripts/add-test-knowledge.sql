-- Add test knowledge base content for Air Fryer Geek
-- This simulates what would be created from actual video processing

-- Insert test content chunks
INSERT INTO ContentChunk (
  id, videoId, content, startTime, endTime, chunkIndex, 
  embedding, metadata, createdAt, updatedAt
) 
SELECT 
  'test_' || substr(md5(random()::text), 1, 8) as id,
  (SELECT id FROM Video LIMIT 1) as videoId,
  chunk.content,
  chunk.startTime,
  chunk.endTime, 
  chunk.chunkIndex,
  json(chunk.embedding) as embedding,
  json(chunk.metadata) as metadata,
  datetime('now') as createdAt,
  datetime('now') as updatedAt
FROM (
  VALUES 
    (
      'Welcome to my air fryer channel! Today I''m going to show you how to make crispy air fryer chicken wings. The key to perfect wings is getting the temperature right - I always start at 380°F.',
      0, 30, 1,
      '[0.1, 0.2, 0.3, -0.1, 0.5, 0.2, -0.3, 0.4, 0.1, -0.2]',
      '{"videoTitle": "Perfect Air Fryer Chicken Wings", "videoUrl": "https://youtube.com/watch?v=test1", "level": "retrieval", "keywords": ["air fryer", "chicken wings", "temperature"], "topics": ["cooking"], "confidence": 0.9}'
    ),
    (
      'For the best air fryer french fries, you need to soak your potatoes in cold water for at least 30 minutes. This removes excess starch and gives you that perfect crispy exterior.',
      0, 45, 1, 
      '[0.2, -0.1, 0.4, 0.3, -0.2, 0.6, 0.1, -0.4, 0.3, 0.2]',
      '{"videoTitle": "Crispy Air Fryer French Fries", "videoUrl": "https://youtube.com/watch?v=test2", "level": "retrieval", "keywords": ["french fries", "potatoes", "crispy"], "topics": ["sides"], "confidence": 0.85}'
    ),
    (
      'When making arancini in the air fryer, the secret is to freeze them for 20 minutes first. This helps them hold their shape during cooking. Set your air fryer to 375°F and cook for 12 minutes.',
      60, 120, 2,
      '[-0.1, 0.3, 0.2, -0.4, 0.1, 0.5, -0.2, 0.3, 0.4, -0.1]',
      '{"videoTitle": "How to Make Air Fryer Arancini", "videoUrl": "https://youtube.com/watch?v=test3", "level": "retrieval", "keywords": ["arancini", "freeze", "375 degrees"], "topics": ["italian", "rice"], "confidence": 0.88}'
    ),
    (
      'My air fryer bacon technique is foolproof. Line the basket with parchment paper, lay the bacon in a single layer, and cook at 350°F for 8-10 minutes depending on thickness.',
      30, 80, 1,
      '[0.4, -0.2, 0.1, 0.3, -0.5, 0.2, 0.4, -0.1, 0.3, 0.2]',
      '{"videoTitle": "Perfect Air Fryer Bacon", "videoUrl": "https://youtube.com/watch?v=test4", "level": "retrieval", "keywords": ["bacon", "parchment paper", "350 degrees"], "topics": ["breakfast"], "confidence": 0.92}'
    ),
    (
      'For air fryer vegetables, the key is not to overcrowd the basket. Cut everything to similar sizes for even cooking. Asparagus takes 7 minutes at 400°F, brussels sprouts need 12 minutes.',
      45, 90, 1,
      '[0.3, 0.1, -0.2, 0.4, 0.2, -0.3, 0.5, 0.1, -0.4, 0.3]',
      '{"videoTitle": "Air Fryer Vegetables Guide", "videoUrl": "https://youtube.com/watch?v=test5", "level": "retrieval", "keywords": ["vegetables", "asparagus", "brussels sprouts", "400 degrees"], "topics": ["healthy", "vegetables"], "confidence": 0.87}'
    )
) as chunk(content, startTime, endTime, chunkIndex, embedding, metadata)
WHERE EXISTS (SELECT 1 FROM Video LIMIT 1);

-- Update video to mark as processed
UPDATE Video SET isProcessed = 1 WHERE EXISTS (SELECT 1 FROM ContentChunk WHERE videoId = Video.id);
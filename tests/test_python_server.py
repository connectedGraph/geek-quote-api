import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
import server  # noqa: E402


class PythonApiDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.load_quotes()

    def test_dataset_and_filtering(self):
        self.assertEqual(len(server.QUOTES), 560)
        ai_quotes = server.filter_quotes(category="ai_ml", lang="both")
        self.assertGreater(len(ai_quotes), 0)
        self.assertTrue(all(item["content_zh"] and item["content_en"] for item in ai_quotes))

    def test_stats(self):
        stats = server.get_stats()
        self.assertEqual(stats["total_quotes"], 560)
        self.assertEqual(stats["server"], "Python (stdlib)")
        self.assertEqual(stats["by_language"]["zh"], 560)
        self.assertEqual(stats["by_language"]["en"], 560)


if __name__ == "__main__":
    unittest.main()

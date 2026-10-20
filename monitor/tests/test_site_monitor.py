"""Tests for the site monitor against a local fixture site (no internet needed).
Run: python3 -m unittest discover -s monitor/tests"""
import functools, http.server, json, socketserver, sys, tempfile, threading, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import site_monitor as sm  # noqa: E402


def serve(directory):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(directory))
    srv = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}'


class MonitorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        site = Path(cls.tmp.name) / 'site'
        other = Path(cls.tmp.name) / 'other'
        site.mkdir(); other.mkdir()
        cls.other_srv, other_url = serve(other)            # a second host: "outside" links, all 404
        for f in (HERE / 'fixture').iterdir():
            (site / f.name).write_text(f.read_text().replace('EXTERNAL', other_url))
        cls.srv, cls.url = serve(site)
        cfg = json.loads((HERE.parent / 'config.json').read_text())
        cfg.update(delay_seconds=0, max_pages=20)
        site_cfg = {'name': 'Fixture', 'start_url': cls.url + '/index.html', 'known_script_hosts': []}
        res = sm.Monitor(cfg).run_site(site_cfg)
        cls.text, cls.n_act = sm.report([res], cfg)

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown(); cls.other_srv.shutdown(); cls.tmp.cleanup()

    def test_broken_internal_and_external_links(self):
        self.assertIn('missing.html', self.text)
        self.assertIn('/gone', self.text)

    def test_passive_security_findings(self):
        self.assertIn('does not use HTTPS', self.text)
        self.assertIn('new outside sources', self.text)
        self.assertIn('cdn.example.com', self.text)
        self.assertIn('Insecure (http://) content', self.text)
        self.assertIn('without rel=noopener', self.text)

    def test_content_findings(self):
        self.assertIn('without alt text', self.text)
        self.assertIn('older years (2015)', self.text)
        self.assertIn('info@example.org', self.text)

    def test_spelling_when_codespell_available(self):
        if not sm.shutil.which('codespell'):
            self.skipTest('codespell not installed')
        self.assertIn('recieve', self.text)

    def test_report_shape(self):
        self.assertTrue(self.text.startswith('# Site health report'))
        self.assertIn('### Action needed', self.text)
        self.assertGreater(self.n_act, 0)
        self.assertIn('@claude please fix', self.text)
        self.assertNotIn('good.html (404', self.text)


if __name__ == '__main__':
    unittest.main()

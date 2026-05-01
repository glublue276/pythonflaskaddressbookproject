.PHONY: test test-unit test-ui test-ui-debug clean-ui reset-pytest-cache

test: test-unit test-ui

test-unit:
	.venv/bin/python -m pytest tests/e2e/unit-tests/test_app.py

test-ui:
	npm run test:e2e

test-ui-debug:
	npm run test:e2e:debug

clean-ui:
	pkill -f "playwright test" || true

reset-pytest-cache:
	rm -rf .pytest_cache
	mkdir -p .pytest_cache/v/cache
	chmod -R u+rwX .pytest_cache

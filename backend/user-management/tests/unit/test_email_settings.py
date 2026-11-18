"""SMTP settings are checked at start-up, and `test-email` reports the outcome without showing the password."""

import argparse

import pytest
from pydantic import SecretStr, ValidationError

from app.cli import __main__ as cli
from app.core.config import Settings, get_settings


def _settings(**changes: object) -> Settings:
    return Settings(**{**get_settings().model_dump(), **changes})


def test_a_real_mail_server_needs_a_username_and_password() -> None:
    with pytest.raises(ValidationError, match="SMTP_USERNAME and SMTP_PASSWORD"):
        _settings(EMAIL_BACKEND="smtp", SMTP_HOST="mail.example.com", SMTP_USERNAME=None, SMTP_PASSWORD=None)
    with pytest.raises(ValidationError, match="SMTP_USERNAME and SMTP_PASSWORD"):
        _settings(EMAIL_BACKEND="smtp", SMTP_HOST="mail.example.com", SMTP_USERNAME="user", SMTP_PASSWORD=None)


def test_a_complete_setup_and_a_local_relay_are_accepted() -> None:
    _settings(EMAIL_BACKEND="smtp", SMTP_HOST="mail.example.com", SMTP_USERNAME="user", SMTP_PASSWORD=SecretStr("pw"))
    _settings(EMAIL_BACKEND="smtp", SMTP_HOST="localhost", SMTP_USERNAME=None, SMTP_PASSWORD=None)
    _settings(EMAIL_BACKEND="console", SMTP_HOST="mail.example.com", SMTP_USERNAME=None, SMTP_PASSWORD=None)


async def test_test_email_reports_success_and_never_prints_the_password(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    sent: list[str] = []

    async def fake_send(self: object, message: object) -> None:
        sent.append(message.to)  # type: ignore[attr-defined]

    secret = _settings(SMTP_USERNAME="AKIA-EXAMPLE-USER", SMTP_PASSWORD=SecretStr("s3cret-pass-word"))
    monkeypatch.setattr(cli, "get_settings", lambda: secret)
    monkeypatch.setattr(cli.SmtpEmailSender, "send", fake_send)
    assert await cli.test_email(argparse.Namespace(to="someone@example.com")) == 0
    output = capsys.readouterr().out
    assert sent == ["someone@example.com"]
    assert "Accepted by the mail server" in output
    assert "s3cret-pass-word" not in output and "AKIA-EXAMPLE-USER" not in output  # only the first four characters of the user


async def test_test_email_reports_what_went_wrong(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    async def refuse(self: object, message: object) -> None:
        raise ConnectionRefusedError("refused")

    monkeypatch.setattr(cli.SmtpEmailSender, "send", refuse)
    assert await cli.test_email(argparse.Namespace(to="someone@example.com")) == 1
    assert "NOT SENT: ConnectionRefusedError: refused" in capsys.readouterr().err

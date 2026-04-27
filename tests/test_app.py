from types import SimpleNamespace

from bson import ObjectId

import app as address_book_app


class FakeCursor:
    def __init__(self, documents):
        self._documents = documents

    def sort(self, field, direction):
        reverse = direction == -1
        return FakeCursor(
            sorted(
                self._documents,
                key=lambda item: item.get(field, ''),
                reverse=reverse,
            )
        )

    def __iter__(self):
        return iter(self._documents)


class FakeCollection:
    def __init__(self):
        self.documents = []

    def create_index(self, _field):
        return None

    def find(self, query):
        return FakeCursor([doc for doc in self.documents if self._matches(doc, query)])

    def find_one(self, query):
        for document in self.documents:
            if self._matches(document, query):
                return document
        return None

    def insert_one(self, document):
        stored = dict(document)
        stored['_id'] = ObjectId()
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored['_id'])

    def replace_one(self, query, document):
        for index, existing in enumerate(self.documents):
            if self._matches(existing, query):
                stored = dict(document)
                stored['_id'] = existing['_id']
                self.documents[index] = stored
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    def update_one(self, query, update):
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get('$set', {}))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if self._matches(document, query):
                self.documents.pop(index)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def _matches(self, document, query):
        for field, expected in query.items():
            if field == '_id':
                if document.get('_id') != expected:
                    return False
                continue
            actual = str(document.get(field, ''))
            if isinstance(expected, dict) and '$regex' in expected:
                if expected['$regex'].lower() not in actual.lower():
                    return False
                continue
            if document.get(field) != expected:
                return False
        return True


def seed_contact(collection, **overrides):
    contact = {
        '_id': ObjectId(),
        'first_name': 'Ava',
        'last_name': 'Patel',
        'address': '1428 Market Street',
        'phone_number': '415-555-0101',
        'extra_fields': {'company': 'Northwind Labs'},
    }
    contact.update(overrides)
    contact['searchable_text'] = address_book_app.build_searchable_text(contact)
    collection.documents.append(contact)
    return contact


def make_client(monkeypatch):
    fake_collection = FakeCollection()
    monkeypatch.setattr(address_book_app, 'contacts_collection', fake_collection)
    monkeypatch.setattr(address_book_app, 'indexes_ready', False)
    return address_book_app.app.test_client(), fake_collection


def test_create_contact(monkeypatch):
    client, collection = make_client(monkeypatch)

    response = client.post(
        '/api/contacts',
        json={
            'first_name': 'Elena',
            'last_name': 'Garcia',
            'address': '501 Lake Shore Drive',
            'phone_number': '312-555-0199',
            'extra_fields': {'notes': 'Friend'},
        },
    )

    payload = response.get_json()
    assert response.status_code == 201
    assert payload['first_name'] == 'Elena'
    assert payload['extra_fields']['notes'] == 'Friend'
    assert collection.documents[0]['searchable_text'].startswith('elena garcia')


def test_keyword_search_returns_matching_contact(monkeypatch):
    client, collection = make_client(monkeypatch)
    seed_contact(collection)
    seed_contact(
        collection,
        first_name='Noah',
        last_name='Kim',
        extra_fields={'notes': 'Met at meetup'},
    )

    response = client.get('/api/contacts?keyword=meetup')

    payload = response.get_json()
    assert response.status_code == 200
    assert len(payload) == 1
    assert payload[0]['first_name'] == 'Noah'


def test_update_custom_field(monkeypatch):
    client, collection = make_client(monkeypatch)
    contact = seed_contact(collection)

    response = client.patch(
        f"/api/contacts/{contact['_id']}/fields",
        json={'field_name': 'nickname', 'value': 'Ave'},
    )

    payload = response.get_json()
    assert response.status_code == 200
    assert payload['extra_fields']['nickname'] == 'Ave'
    assert collection.documents[0]['extra_fields']['nickname'] == 'Ave'


def test_delete_contact(monkeypatch):
    client, collection = make_client(monkeypatch)
    contact = seed_contact(collection)

    response = client.delete(f"/api/contacts/{contact['_id']}")

    assert response.status_code == 200
    assert response.get_json()['message'] == 'Contact deleted'
    assert collection.documents == []


def test_invalid_contact_id_returns_bad_request(monkeypatch):
    client, _collection = make_client(monkeypatch)

    response = client.patch('/api/contacts/not-a-valid-id', json={'first_name': 'Test'})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Invalid contact id'

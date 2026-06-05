# Union Inference Test Matrix

| Input Case | Input String | Expected Normalized Values | Expected Control | Status |
| :--- | :--- | :--- | :--- | :--- |
| Optional Literal | `'a' \| 'b' \| undefined` | `['a', 'b']` | `radio` | ✅ |
| Single Quoted | `'red' \| 'blue' \| 'green'` | `['red', 'blue', 'green']` | `radio` | ✅ |
| Large Union | `'v1' \| 'v2' \| 'v3' \| 'v4' \| 'v5' \| 'v6'` | `['v1', 'v2', 'v3', 'v4', 'v5', 'v6']` | `select` | ✅ |
| Mixed Complex | `string \| number \| null` | `[]` | `object` | ✅ |
| Void/Null Union | `void \| null \| 'active'` | `['active']` | `radio` | ✅ |

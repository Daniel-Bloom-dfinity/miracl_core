/*
   Copyright (C) 2019 MIRACL UK Ltd.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.


    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

     https://www.gnu.org/licenses/agpl-3.0.en.html

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   You can be released from the requirements of the license by purchasing     
   a commercial license. Buying such a license is mandatory as soon as you
   develop commercial activities involving the MIRACL Core Crypto SDK
   without disclosing the source code of your own applications, or shipping
   the MIRACL Core Crypto SDK with a closed source product.     
*/

/* Fixed Data in ROM - Field and Curve parameters */

package C1665

// Base Bits= 29
var Modulus= [...]Chunk {0x1FFFFFFB,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFF}
var R2modp= [...]Chunk {0x190000,0x0,0x0,0x0,0x0,0x0}
var ROI= [...]Chunk {0x1FFFFFFA,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFFFF,0x1FFFFF}
const MConst Chunk=0x5

//*** rom curve parameters *****
// Base Bits= 29

const CURVE_A int= 1
const CURVE_Cof_I int= 4
var CURVE_Cof= [...]Chunk {0x4,0x0,0x0,0x0,0x0,0x0}
const CURVE_B_I int= 5766
var CURVE_B= [...]Chunk {0x1686,0x0,0x0,0x0,0x0,0x0}
var CURVE_Order= [...]Chunk {0x1DBA8B27,0x7F854C,0x1F57BC06,0x1FFFFFFF,0x1FFFFFFF,0x7FFFF}
var CURVE_Gx= [...]Chunk {0x19D52398,0x138DCEDF,0x183D99B1,0x1340C31D,0x1A505B80,0xA64A6}
var CURVE_Gy= [...]Chunk {0x4920345,0x3843D92,0x758B70B,0x77F8EE7,0x149BC0A1,0x14A0A2}
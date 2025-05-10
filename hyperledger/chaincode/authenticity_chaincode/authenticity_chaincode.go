// ###################################################################################################################################
// #####################################################SHIM#########################################################################
package main

import (
	"bytes"
	"encoding/json"
	"fmt" //Package fmt implements formatted I/O with functions analogous to C's printf and scanf. The format 'verbs' are derived from C's but are simpler.
	// "strconv"
	// "time"

	"github.com/hyperledger/fabric-chaincode-go/shim" //Package shim provides APIs for the chaincode to access its state variables, transaction context and call other chaincodes.
	sc "github.com/hyperledger/fabric-protos-go/peer" //  ChaincodeEndorsement instructs the peer how transactions should be endorsed. The only endorsement mechanism which ships with the
	"github.com/hyperledger/fabric/common/flogging" // Logging in the peer and orderer is provided by the common/flogging package. This package supports. Logging control based on the severity of the message 

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid" // Import for Client Identity
)

// Define the Admin MSP ID
const ADMIN_MSPID = "Samsung1MSP"

// SmartContract Define the Smart Contract structure
type SmartContract struct {
}

// Existing structure
type StoreItem struct {
	Company_org   string `json:"company_org"`
	Item_type  string `json:"item_type"`
	Item_name string `json:"item_name"`	
	Item_serial_number  string `json:"item_serial_number"`
}

// Init ;  Method for initializing smart contract
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

var logger = flogging.MustGetLogger("authenticity_chaincode_chaincode")

// Invoke :  Method for INVOKING smart contract
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	function, args := APIstub.GetFunctionAndParameters()
	// logger.Infof("Function name is:  %d", function)
	// logger.Infof("Args length is : %d", len(args))

	switch function {
	case "queryStoreItem":
		return s.queryStoreItem(APIstub, args)
	case "initLedger":
		return s.initLedger(APIstub)
	case "createStoreItem":
		return s.createStoreItem(APIstub, args)
	case "queryAllItems":
		return s.queryAllItems(APIstub)
	case "queryItemsByOwner":
		return s.queryItemsByOwner(APIstub, args)
	case "updateItemDetails":
		return s.updateItemDetails(APIstub, args)
	case "deleteItem":
		return s.deleteItem(APIstub, args)
	case "changeItemOwner":
		return s.changeItemOwner(APIstub, args)
	default:
		return shim.Error("Invalid function name: " + function)
	}
}

func (s *SmartContract) queryStoreItem(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	itemAsBytes, _ := APIstub.GetState(args[0])
	if itemAsBytes == nil {
		// Return error in a format the API might expect (e.g., JSON string)
		return shim.Error("{\"Error\":\"Item does not exist: " + args[0] + "\"}")
	}
	return shim.Success(itemAsBytes)
}

func (s *SmartContract) initLedger(APIstub shim.ChaincodeStubInterface) sc.Response {
	store_items := []StoreItem{
		StoreItem{Company_org: "Samsung", Item_type: "Earbuds", Item_name: "Buds2", Item_serial_number: "2345-4235-8432-1352"},
		StoreItem{Company_org: "Samsung", Item_type: "Smartphone", Item_name: "S21", Item_serial_number: "2345-4235-0743-1234"},
		StoreItem{Company_org: "Samsung", Item_type: "Tablet", Item_name: "S9", Item_serial_number: "2345-8420-7521-9041"},
		StoreItem{Company_org: "Sony", Item_type: "Smartphone", Item_name: "Xperia6X", Item_serial_number: "5346-7892-9331-3452"},
		StoreItem{Company_org: "Sony", Item_type: "Headset", Item_name: "Xherp523", Item_serial_number: "5346-0734-9532-8331"},
		StoreItem{Company_org: "Sony", Item_type: "Console", Item_name: "Ps5", Item_serial_number: "5346-7211-7234-7833"},
	}

	i := 0
	for i < len(store_items) {
		store_itemsAsBytes, _ := json.Marshal(store_items[i])
		// APIstub.PutState("store_item"+strconv.Itoa(i), store_itemsAsBytes)
		APIstub.PutState(store_items[i].Item_serial_number, store_itemsAsBytes)
		i = i + 1
	}

	return shim.Success(nil)
}

func (s *SmartContract) createStoreItem(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4 (companyOrg, itemType, itemName, itemSerialNumber)")
	}

	companyOrg := args[0]
	itemType := args[1]
	itemName := args[2]
	itemSerialNumber := args[3]

	// === Check if item already exists ===
	existingItemBytes, err := APIstub.GetState(itemSerialNumber)
	if err != nil {
		return shim.Error("Failed to get item: " + err.Error())
	}
	if existingItemBytes != nil {
		return shim.Error("Item with this serial number already exists: " + itemSerialNumber)
	}

	// === Get submitting client's organization ===
	// Note: This assumes the organization name is directly usable as the Company_org field.
	// Adjust parsing if using full cert details.
	clientOrg, err := cid.GetMSPID(APIstub)
	if err != nil {
		return shim.Error("Failed to get client MSPID: " + err.Error())
	}
	// Optional: Check if clientOrg matches the provided companyOrg if desired
	// if clientOrg != companyOrg { 
	// 	 return shim.Error("Client organization does not match provided company organization")
	// }

	var item = StoreItem{Company_org: companyOrg, Item_type: itemType, Item_name: itemName, Item_serial_number: itemSerialNumber}

	itemAsBytes, _ := json.Marshal(item)
	errPut := APIstub.PutState(item.Item_serial_number, itemAsBytes)
	if errPut != nil {
		return shim.Error(fmt.Sprintf("Failed to create item: %s", errPut.Error()))
	}

	logger.Infof("Item Created: %s by %s", itemSerialNumber, clientOrg)
	return shim.Success(itemAsBytes)
}

func (s *SmartContract) queryAllItems(APIstub shim.ChaincodeStubInterface) sc.Response {

	beginKey := "0000-0000-0000-0000"
	lastKey := "9999-9999-9999-9999"

	resultsIterator, err := APIstub.GetStateByRange(beginKey, lastKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Check if the value is likely a StoreItem before adding (basic check)
		var item StoreItem
		errUnmarshal := json.Unmarshal(queryResponse.Value, &item)
		if errUnmarshal == nil && item.Item_serial_number == queryResponse.Key {
			if bArrayMemberAlreadyWritten == true {
				buffer.WriteString(",")
			}
			buffer.WriteString("{\"Key\":")
			buffer.WriteString("\"")
			buffer.WriteString(queryResponse.Key)
			buffer.WriteString("\"")

			buffer.WriteString(", \"Record\":")
			buffer.WriteString(string(queryResponse.Value))
			buffer.WriteString("}")
			bArrayMemberAlreadyWritten = true
		}
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllItems:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) queryItemsByOwner(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1 (ownerOrg)")
	}
	ownerOrg := args[0]

	// Use a range query and filter, or ideally a rich query if using CouchDB
	// Simple range query for demonstration (inefficient for large datasets)
	beginKey := "0000-0000-0000-0000"
	lastKey := "9999-9999-9999-9999"

	resultsIterator, err := APIstub.GetStateByRange(beginKey, lastKey)
	if err != nil {
		return shim.Error("Failed to get state by range: " + err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}

		var item StoreItem
		errUnmarshal := json.Unmarshal(queryResponse.Value, &item)
		// Filter by owner and ensure it looks like a StoreItem
		if errUnmarshal == nil && item.Item_serial_number == queryResponse.Key && item.Company_org == ownerOrg {
			if bArrayMemberAlreadyWritten == true {
				buffer.WriteString(",")
			}
			// Return the record directly, no need for Key/Record structure here
			buffer.WriteString(string(queryResponse.Value))
			bArrayMemberAlreadyWritten = true
		}
	}
	buffer.WriteString("]")

	logger.Infof("- queryItemsByOwner (%s):\n%s\n", ownerOrg, buffer.String())
	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) updateItemDetails(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3 (serialNumber, newName, newType)")
	}

	serialNumber := args[0]
	newName := args[1]
	newType := args[2]

	// Get current item state
	itemAsBytes, err := APIstub.GetState(serialNumber)
	if err != nil {
		return shim.Error("Failed to get item: " + err.Error())
	}
	if itemAsBytes == nil {
		return shim.Error("Item not found: " + serialNumber)
	}

	var item StoreItem
	errUnmarshal := json.Unmarshal(itemAsBytes, &item)
	if errUnmarshal != nil {
		return shim.Error("Failed to unmarshal item: " + errUnmarshal.Error())
	}

	// === Authorization Check ===
	clientOrg, err := cid.GetMSPID(APIstub)
	if err != nil {
		return shim.Error("Failed to get client MSPID: " + err.Error())
	}
	// Allow if client is the owner OR if the client is the designated Admin MSPID
	if item.Company_org != clientOrg && clientOrg != ADMIN_MSPID {
		logger.Warningf("Unauthorized update attempt: Client %s tried to update item %s owned by %s", clientOrg, serialNumber, item.Company_org)
		return shim.Error(fmt.Sprintf("Unauthorized. Client organization (%s) does not match item owner (%s) and is not admin", clientOrg, item.Company_org))
	}
	

	// Update fields
	item.Item_name = newName
	item.Item_type = newType

	// Marshal and put state back
	updatedItemAsBytes, _ := json.Marshal(item)
	errPut := APIstub.PutState(serialNumber, updatedItemAsBytes)
	if errPut != nil {
		return shim.Error("Failed to update item details: " + errPut.Error())
	}

	logger.Infof("Item Updated: %s by %s", serialNumber, clientOrg) 
	return shim.Success(updatedItemAsBytes)
}

func (s *SmartContract) deleteItem(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1 (serialNumber)")
	}

	serialNumber := args[0]

	// Get current item state to check ownership before deleting
	itemAsBytes, err := APIstub.GetState(serialNumber)
	if err != nil {
		return shim.Error("Failed to get item for delete check: " + err.Error())
	}
	if itemAsBytes == nil {
		return shim.Error("Item not found, cannot delete: " + serialNumber)
	}

	var item StoreItem
	errUnmarshal := json.Unmarshal(itemAsBytes, &item)
	if errUnmarshal != nil {
		// If it exists but can't be unmarshalled, maybe delete anyway? Or error?
		// Let's error for safety, as we can't verify owner.
		return shim.Error("Failed to unmarshal item data for delete check: " + errUnmarshal.Error())
	}

	// === Authorization Check ===
	clientOrg, err := cid.GetMSPID(APIstub)
	if err != nil {
		return shim.Error("Failed to get client MSPID: " + err.Error())
	}
	// Allow if client is the owner OR if the client is the designated Admin MSPID
	if item.Company_org != clientOrg && clientOrg != ADMIN_MSPID {
		logger.Warningf("Unauthorized delete attempt: Client %s tried to delete item %s owned by %s", clientOrg, serialNumber, item.Company_org)
		return shim.Error(fmt.Sprintf("Unauthorized. Client organization (%s) does not match item owner (%s) and is not admin", clientOrg, item.Company_org))
	}
	

	// Delete the item
	errDel := APIstub.DelState(serialNumber)
	if errDel != nil {
		return shim.Error("Failed to delete item: " + errDel.Error())
	}

	logger.Infof("Item Deleted: %s by %s", serialNumber, clientOrg) 
	return shim.Success(nil) // Success response with no payload for delete
}

func (s *SmartContract) changeItemOwner(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 2 {
		// Corrected error message to reflect expected arguments
		return shim.Error("Incorrect number of arguments. Expecting 2: item_serial_number, new_owner")
	}

	// Declare and assign itemKey and newOwner from arguments
	itemKey := args[0]
	newOwner := args[1]

	// Get the current state of the item
	itemAsBytes, err := APIstub.GetState(itemKey)
	if err != nil {
		return shim.Error("Failed to get item state: " + err.Error())
	} else if itemAsBytes == nil {
		// Use the correct variable name in the error message
		return shim.Error("Item not found: " + itemKey)
	}
	
	// Declare item variable ONCE before unmarshalling
	item := StoreItem{}
	errUnmarshal := json.Unmarshal(itemAsBytes, &item)
	if errUnmarshal != nil {
		 return shim.Error("Failed to unmarshal item data: " + errUnmarshal.Error())
	}

	// Update the owner field using the newOwner variable
	item.Company_org = newOwner 

	// Marshal the updated item
	itemAsBytes, err = json.Marshal(item)
	if err != nil {
		 return shim.Error("Failed to marshal updated item: " + err.Error())
	}

	// Put the updated state back onto the ledger using itemKey
	errPut := APIstub.PutState(itemKey, itemAsBytes)
	if errPut != nil {
		return shim.Error("Failed to update item owner: " + errPut.Error())
	}

	return shim.Success(itemAsBytes)
}

// The main function is only relevant in unit test mode. Only included here for completeness.
func main() {

	// Create a new Chaincode
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Failed to create new Chaincode: %s", err)
	}
}
